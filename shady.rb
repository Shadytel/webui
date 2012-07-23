require 'sinatra'
require 'sinatra/json'
require 'yaml'
require 'mongoid'

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
end

class Shortcode
  include Mongoid::Document

  field :number, type: Integer
  field :url,    type: String
end

config = YAML::load_file('shady.config')

set :sessions,       true
set :session_secret, config[:session_secret]

get '*' do
  # Really?
  send_file File.join(settings.public_folder, 'index.html')
end

whitelist = %w(login send_code register)
before '/api/*' do
  return if whitelist.include?(request.path[5..-1])
  unless session && session[:uid] && @user = User.find(session[:uid])
    halt 401, { 'Content-Type' => 'application/json' }, { success: false, message: 'not authenticated' }.to_json
  end
end

post '/api/login' do
  user = User.find(number: params[:number])
  if user
    session.uid = user
    json success: true, user: user
  else
    session.uid = nil
    json success: false
  end
end

post '/api/send_code' do
  # FIXME: Verify user doesn't already exist
  # FIXME: Replace token if already exits

  #ConfirmationToken.create(number: params[:number], token: params[:token])
  # FIXME: Send SMS
end

post '/api/register' do
  # FIXME: User must enter correct token into form.
  token = ConfirmationToken.find(token: params[:token])

end

get '/api/shortcodes' do
  json Shortcode.all
end

post '/api/shortcodes/new' do

end

put '/api/shortcodes/:id' do

end

delete '/api/shortcodes/:id' do
  s = Shortcode.find(params[:id])
  json :success => s.delete
end