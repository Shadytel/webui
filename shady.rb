require 'sinatra'
require 'sinatra/json'
require 'yaml'
require 'mongoid'
require 'bcrypt'

Mongoid.load!('mongoid.yml')
$config = YAML::load_file('shady.config')

class ConfirmationToken
  include Mongoid::Document
  field :number, type: String
  field :token,  type: String
end

class User
  include Mongoid::Document

  # Phone number is the primary key
  field :number,   type: String
  field :password, type: String

  # Optional profile info
  field :name,  type: String
  field :email, type: String

  def as_json
    {
      number: self.number,
      name:   (self.name  || ''),
      email:  (self.email || ''),
      bio:    (self.bio   || '')
    }
  end
end

class Shortcode
  include Mongoid::Document

  field :name,        type: String
  field :description, type: String
  field :number,      type: Integer
  field :url,         type: String

  def as_json
    {
      number:      self.number,
      name:        self.name,
      description: self.description,
      url:         self.url
    }
  end
end

# FIXME
def json_halt(code, message=nil)
  halt code, { 'Content-Type' => 'application/json' }, { success: false, message: message }.to_json
end

def password_digest(password)
  ::BCrypt::Password.create("#{password}#{$config[:password_salt]}").to_s
end

def valid_password?(encrypted_password, password)
  return false if encrypted_password.blank?
  bcrypt   = ::BCrypt::Password.new(encrypted_password)
  password = ::BCrypt::Engine.hash_secret("#{password}#{$config[:password_salt]}", bcrypt.salt)
  puts "COMPARE " + password + " " + encrypted_password
  #Devise.secure_compare(password, encrypted_password)
  password == encrypted_password
end

set :sessions,       true
set :session_secret, $config[:session_secret]

whitelist = %w(login send_code register)
before '/api/*' do
  return if whitelist.include?(request.path[5..-1])
  unless session && session[:uid] && @user = User.where(_id: session[:uid]).first
    json_halt 401, 'not authenticated'
  end
end

get '/api/me' do
  json success: true, user: @user.as_json
end

post '/api/login' do
  if @user = User.where(number: params[:number]).first
    if valid_password?(@user.password, params[:password])
      session[:uid] = @user._id
      json_halt 200, success: true, user: @user.as_json # FIXME
    end
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

  json_halt 500, 'Invalid number' if number.blank? # FIXME: Better validation
  json_halt 500, 'Already registered' unless User.where(number: number).count.zero?

  # new_value = SecureRandom.hex(5).scan(/../).join('-')
  new_value = '1234'

  if token = ConfirmationToken.where(number: number).first
    token.update(value: new_value)
  else
    token = ConfirmationToken.create(number: number, value: new_value)
  end

  # FIXME: Send SMS

  json success: true
end

post '/api/register' do
  user = User.where(number: params[:number]).first
  json_halt 500, 'User already exists' if user

  token = ConfirmationToken.where(number: params[:number], value: params[:token]).first
  json_halt 500, 'Invalid token' unless token

  passwordsMatch = (params[:password] == params[:password_confirm])
  json_halt 500, 'Passwords dont match' unless passwordsMatch

  user = User.create(
    number:   params[:number],
    name:     params[:name],
    email:    params[:email],
    bio:      params[:bio],
    password: password_digest(params[:password])
  )

  session[:uid] = user._id

  token.delete
end

get '/api/shortcodes' do
  codes =  Shortcode.all.map{|s| s.as_json }.to_a
  puts codes.inspect
  json codes
end

get '/api/shortcodes/:number' do
  s = Shortcode.where(number: params[:number], created_by: @user._id).first
  json_halt 404, 'Not found' unless s
  json s
end

post '/api/shortcodes/create' do
  # FIXME: Validate 
  # FIXME: Verify uniqueness
  s = Shortcode.create(
    name:        params[:name],
    description: params[:description],
    number:      "#{params[:numberPrefix]}#{params[:number]}",
    url:         params[:url],
    created_by:  @user._id # FIXME: DBRef that
  )
  json success: true, number: s.number
end

put '/api/shortcodes/:id' do

end

delete '/api/shortcodes/:id' do
  s = Shortcode.find(params[:id])
  json :success => s.delete
end

get '*' do
  # Really?
  send_file File.join(settings.public_folder, 'index.html')
end
