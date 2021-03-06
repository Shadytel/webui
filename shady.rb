require 'sinatra'
require 'sinatra/json'
require 'yaml'
require 'mongoid'
require 'bcrypt'
require 'resque'

Mongoid.load!('mongoid.yml')
$config = YAML::load_file('shady.config')

class ConfirmationToken
  include Mongoid::Document

  validates :number, presence: true, uniqueness: true
  validates :value,  presence: true

  field :number, type: String
  field :value,  type: String
end

class User
  include Mongoid::Document

  validates :number,   presence: true, uniqueness: true, numericality: { even: true, only_integer: true }
  validates :password, presence: true, confirmation: true, length: { minimum: 8, maximum: 16, allow_blank: false }, if: :validate_password?
  validates :password_confirmation, presence: true, if: :validate_password?

  validate :verify_existing_password, on: :update, if: Proc.new { |user| user.password.present? }

  validate :verify_token, on: :create

  attr_accessor :token
  attr_accessor :password
  attr_accessor :password_confirmation
  attr_accessor :existing_password

  before_validation :clean_token
  before_save :prepare_password
  after_create :delete_token

  field :number,        type: String
  field :password_hash, type: String

  # Optional profile info
  field :name,  type: String
  field :email, type: String

  attr_protected :number
  attr_protected :password_hash

  def as_json
    {
      number: self.number,
      name:   (self.name  || ''),
      email:  (self.email || ''),
      bio:    (self.bio   || ''),
      display: (self.name.present? ? self.name : self.number)
    }
  end

  def self.authenticate(number, pass)
    user = User.where(number: number).first
    return user if user && user.matching_password?(pass)
  end
  
  def matching_password?(pass)
    BCrypt::Password.new(self.password_hash) == pass
  end

  private

  def clean_token
    self.token = self.token.gsub(/[^0-9a-f]/i, '').downcase if self.token.present?
  end

  def verify_token
    unless find_token
      self.errors.add(:token, 'Incorrect token')
    end
  end

  def verify_existing_password
    unless matching_password?(self.existing_password)
      self.errors.add(:existing_password, 'is not correct')
    end
  end

  def prepare_password
    unless password.blank?
      self.password_hash = ::BCrypt::Password.create(self.password).to_s
    end
  end

  def delete_token
    find_token.delete
  end

  def find_token
    ConfirmationToken.where(number: self.number, value: self.token).first
  end

  def validate_password?()
    # Validate password if there's no encrypted password (new account) or if 
    # the user specified a new password (edit account)
    password_hash.blank? || password.present?
  end
end

class Shortcode
  include Mongoid::Document

  VALID_PREFIXES = %w(3 4 5)

  belongs_to :owner, :class_name => 'User'

  field :name,        type: String
  field :description, type: String
  field :number,      type: String
  field :url,         type: String
  field :api_key,     type: String
  field :api_secret,  type: String
  field :owner_id,    type: Moped::BSON::ObjectId

  attr_protected :number
  attr_protected :api_key
  attr_protected :api_secret

  validates :name,        presence: true, uniqueness: true
  validates :description, presence: true
  validates :url,         presence: true, format: { with: URI::regexp([/^http/, /^https/]) }
  validates :owner_id,    presence: true
  validates :number,      presence: true, uniqueness: true, numericality: { even: true, only_integer: true }
  validates :api_key,     presence: true, uniqueness: true
  validates :api_secret,  presence: true, uniqueness: true

  validate :check_number

  before_validation :generate_keys

  def as_json
    {
      number:      self.number,
      name:        self.name,
      description: self.description,
      url:         self.url,
      api_key:     self.api_key || '',
      api_secret:  self.api_secret || '',
      owner:       self.owner.as_json
    }
  end

  def build_number(prefix, suffix)
    self.number = "#{prefix}-#{suffix}"
    puts "built number #{self.number}" # FIXME
  end

  private

  def generate_keys
    self.api_key    = SecureRandom.hex unless self.api_key.present?
    self.api_secret = SecureRandom.hex unless self.api_secret.present?
  end

  def check_number
    number = self.number.to_i
    self.errors.add(:number, 'invalid prefix') unless VALID_PREFIXES.any? { |prefix| self.number.starts_with?(prefix) }
    self.errors.add(:number, 'invalid number') unless self.number.length > 1
  end
end

class Message
  include Mongoid::Document

  validates :from_dn, presence: true
  validates :to_dn,   presence: true

  field :from_dn, type: String
  field :to_dn,   type: String
  # field :body_type, 
  field :body,    type: String
end

class SendSMS
  @queue = :sms_send
  def self.perform(from_number, to_number, message)
    sleep 10 # FIXME
  end
end

class ReceiveSMS
  @queue = :sms_receive
  def self.perform(data)
    from_number = data[:from_number]
    to_number   = data[:to_number]
    message     = data[:message]
    if s = Shortcode.where(number: to_number)
      Resque.enqueue(ShortcodeCallback, from_number, s.callback, message)
    else
      # Send back to subscriber
      async_send_sms(from_number, to_number, message)
    end
  end
end

class ShortcodeCallback
  @queue = :shortcode_cb
  def self.perform(from_number, url, message)
    # POST data to url!
    
  end
end

def async_send_sms(from_number, to_number, message)
  Resque.enqueue(SendSMS, from_number, to_number, message)
end

# FIXME
def json_halt(code, message=nil)
  halt code, { 'Content-Type' => 'application/json' }, { success: false, message: message }.to_json
end

def json_error(json)
  halt 400, { 'Content-Type' => 'application/json' }, { success: false }.merge(json).to_json
end

def verify_hmac(api_secret, post_data)
  signature = post_data[:signature]
  msg = post_data.sort.reject { |k, v| k == 'signature' }.map do |k, v| 
    '%s=%s' % [ k, CGI::escape(v[0]) ]
  end.join('&')
  real_hmac = HMAC::SHA512.new(api_secret).update(msg).hexdigest
  (untrusted_hmac == real_hmac)
end

set :sessions,       true
set :session_secret, $config[:session_secret]

whitelist = [
  /^\/api\/login$/,
  /^\/api\/send_code$/,
  /^\/api\/register$/,
  /^\/api\/subscribers$/,
  /^\/api\/subscribers\/\d*$/,
  /^\/api\/shortcodes$/,
  /^\/api\/incoming_sms$/,
  /^\/api\/send_sms$/
]
before '/api/*' do
  return if whitelist.any?{|expr| expr =~ request.path }
  unless session && session[:uid] && @user = User.where(_id: session[:uid]).first
    json_halt 401, 'not authenticated'
  end
end

# Called by the SMSMC
post '/api/incoming_sms' do
  post_data = CGI::parse(request.body.read)
  json_halt 401, 'invalid signature' unless verify_hmac($config[:smsmc_key], post_data)
  Resque.enqueue(ReceiveSMS, post_data)
end

# Called by Shortcode providers
post '/api/send_sms' do
  post_data = CGI::parse(request.body.read)
  s = Shortcode.where(api_key: params[:api_key]).first
  json_halt 401, 'invalid api key'   unless s
  json_halt 401, 'invalid signature' unless verify_hmac(s.api_secret, post_data)
  async_send_sms(s.number, post_data[:number], post_data[:message])
end

get '/api/me' do
  json success: true, user: @user.as_json
end

put '/api/me' do
  if @user.update_attributes(params)
    json success: true, user: @user.as_json
  else
    json_error errors: @user.errors.as_json
  end
end

get '/api/subscribers' do
  json User.all.map {|u| u.as_json }
end

get '/api/subscribers/:number' do
  u = User.where(number: params[:number]).first
  json_halt 404, 'Not found' unless u
  json u.as_json
end

get '/api/shortcodes' do
  json Shortcode.all.map {|s| s.as_json }
end

post '/api/login' do
  if @user = User.authenticate(params[:number], params[:password])
    session[:uid] = @user._id
    json_halt 200, success: true, user: @user.as_json # FIXME
  end

  session[:uid] = nil
  json_halt 401, 'bad username or password'
end

post '/api/logout' do
  session[:uid] = nil
  json success: true
end

post '/api/send_code' do
  number = params[:number]
  number = number.gsub(/\D/, '')

  json_halt 400, 'Already registered' unless User.where(number: number).count.zero?

  new_value = SecureRandom.hex(4).downcase

  if token = ConfirmationToken.where(number: number).first
    token.set(value: new_value)
  else
    token = ConfirmationToken.new(number: number, value: new_value)
  end

  if token.save
    pretty_value = token.value.scan(/../).join('-')
    async_send_sms('611', number, "Enter this confirmation code into the Shadytel website: #{pretty_value}.")
    json success: true, number: number
  else
    json_error errors: token.errors.as_json
  end
end

post '/api/register' do
  user = User.where(number: params[:number]).first
  json_halt 400, 'User already exists' if user

  user = User.new(params)
  user.number = params[:number]

  unless user.save
    json_error errors: user.errors.as_json
  end

  session[:uid] = user._id

  json success: true
end

get '/api/my-shortcodes' do
  codes =  Shortcode.where(owner_id: @user._id).all.map{|s| s.as_json }.to_a
  json codes
end

get '/api/my-shortcodes/:number' do
  s = Shortcode.where(number: params[:number], owner_id: @user._id).first
  json_halt 404, 'Not found' unless s
  json s.as_json
end

post '/api/my-shortcodes' do
  data = JSON.parse(request.body.read)
  s = Shortcode.new
  s.number = data['number']
  s.owner_id = @user._id
  s.attributes = {
    name:        data['name'],
    description: data['description'],
    url:         data['url'],
  }

  if s.save
    json success: true, number: s.number
  else
    json_error errors: s.errors.as_json
  end
end

put '/api/my-shortcodes/:number' do
  data = JSON.parse(request.body.read)
  s = Shortcode.where(number: params[:number], owner_id: @user._id).first
  if s.update_attributes(data)
    json success: true
  else
    json_error errors: s.errors.as_json
  end
end

delete '/api/my-shortcodes/:number' do
  # FIXME: Verify ID!
  s = Shortcode.where(number: params[:number], owner_id: @user._id).first
  json_halt 404, 'not found' unless s
  if s.delete
    json :success => true
  else
    json_halt 400, 'failed to delete'
  end
end

get '*' do
  # Really?
  send_file File.join(settings.public_folder, 'index.html')
end
