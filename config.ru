require './shady'
require './utils'
require 'resque'
require 'resque/server'

if ENV.include?('REDISTOGO_URL')
  uri = URI.parse(ENV['REDISTOGO_URL'])
  Resque.redis = Redis.new(:host => uri.host, :port => uri.port, :password => uri.password)
end

Resque::Server.use Rack::Auth::Basic do |username, password|
  (username == 'admin') && (BCrypt::Password.new($config[:resque_admin_pass]) == password)
end

run Rack::URLMap.new \
  "/"       => Sinatra::Application.new,
  "/resque" => Resque::Server.new
