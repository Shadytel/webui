function setAccountView(subView) { // FIXME: Move this
  var accountView;
  if (app.currentView instanceof AccountView) {
    accountView = app.currentView;
  } else {
    var accountView = new AccountView();
    app.setView(accountView);
  }
  accountView.setView(subView);
}

var ShadyRouter = Backbone.Router.extend({
  routes: {
    '':                           'home',
    'home':                       'home',
    'shortcodes':                 'shortcodes',
    'subscribers':                'subscribers',
    'subscribers/:number':        'subscriber',
    'applets':                    'applets',
    'account':                    'accountApps',
    'account/login':              'accountLogin',
    'account/register':           'accountRegister',
    'account/shortcodes':         'accountApps',
    'account/shortcodes/new':     'accountAppsNew',
    'account/shortcodes/:number': 'accountApp',
    'account/applets':            'accountApplets',
    'account/profile':            'accountProfile'
  },

  home: function() {
    app.setView(new StatusView());
  },

  shortcodes: function() {
    app.setView(new ShortcodesView());
  },

  subscribers: function() {
    app.setView(new SubscribersView());
  },

  subscriber: function(number) {
    var subscriber = new Subscriber({ id: number });
    app.setView(new SubscriberView({ model: subscriber }));
  },

  applets: function() {
    app.setView(new SIMAppletsView());
  },

  accountRegister: function() {
    app.setView(new AccountVerifyView());
  },

  accountLogin: function() {
    app.setView(new LoginView());
  },

  accountApps: function() {
    setAccountView(new AccountShortcodesView());
  },

  accountApplets: function() {
    setAccountView(new AccountAppletsView());
  },

  accountAppsNew: function() {
    setAccountView(new NewShortcodeView());
  },

  accountApp: function(number) {
    var shortcode = new MyShortcode({ number: number });
    setAccountView(new EditMyShortcodeView({ model: shortcode }));
  },

  accountProfile: function() {
    setAccountView(new AccountProfileView());
  }
});

var MyShortcode = Backbone.Model.extend({
  idAttribute: 'number',
  urlRoot:     '/api/my-shortcodes',

  isNew: function() {
    return this._isNew;
  }
});

var Subscriber = Backbone.Model.extend({
  urlRoot: '/api/subscribers'
});

var SubscriberList = Backbone.Collection.extend({
  model: Subscriber,
  url: '/api/subscribers'
});

var Shortcode = Backbone.Model.extend({
});

var ShortcodeList = Backbone.Collection.extend({
  model: Subscriber,
  url: '/api/shortcodes'
});

var MyShortcodeList = Backbone.Collection.extend({
  model: MyShortcode,
  url: '/api/my-shortcodes'
});

var ShortcodeRowView = Backbone.View.extend({
  tagName: 'tr',
  className: 'my-shortcode',

  events: {
    'click': 'open'
  },

  initialize: function() {
    this.model.bind('change',  this.render, this);
    this.model.bind('destroy', this.remove, this);
  },

  render: function() {
    this.$el.empty();
    this.$el.append(ich.ShortcodeRowView(this.model.attributes));
    return this;
  },

  open: function() {
    router.navigate('/account/shortcodes/' + this.model.get('number'), { trigger: true });
    return false;
  }
});

var AppView = Backbone.View.extend({
  initialize: function() {
    $('#app').append($('<div>').addClass('loading'));

    $('#main-nav li a').click(function(elem) {
      router.navigate($(this).attr('href'), { trigger: true })
      return false;
    });
  },

  setView: function (view) {
    if (this.currentView) {
      if (this.currentView.hidden) {
        this.currentView.hidden();
      }

      this.currentView.remove();
    }

    this.currentView = view;
    $('#content').append(view.render().el);
    if (view.shown) {
      view.shown();
    }

    $('#main-nav li').removeClass('active');
    $('#main-nav li#' + this.currentView.mainNavId).addClass('active');
  },

  showLoading: function() {
    $('.loading').show();
    $('.loading').spin();
  },

  hideLoading: function() {
    $('.loading').spin(false);
    $('.loading').hide();
  },

  showSuccessAlert: function(message) {
    var flash = $('#content .alert-success');
    if (flash.length == 0) {
      flash = $('<div>').addClass('alert').addClass('alert-success').addClass('fade').addClass('in');
      flash.append($('<span>').addClass('message').text(message));
      flash.append($('<a class="close" data-dismiss="alert" href="#">×</a>'));
      $('#content').prepend(flash);
      flash.alert();
    } else {
      flash.find('.message').text(message);
    }
  },

  showError: function (text) {
    var dialog = bootbox.modal(text, "Error", {
      "animate": false,
      "backdrop": "static",
      "headerCloseButton": null
    });
  }
});

var StatusView = Backbone.View.extend({
  mainNavId: 'home',

  render: function() {
    this.$el.empty();
    this.$el.append(ich.StatusView);
    return this;
  }
});

var SubscribersView = Backbone.View.extend({
  mainNavId: 'subscribers',

  initialize: function() {
    this.$el.empty()
    this.$el.append(ich.SubscribersView());

    var self = this;
    this.subscribers = new SubscriberList();
    this.subscribers.fetch({
      success: function() {
        self.render();
      }, 
      error: function(model, response) {
        if (response.status != 401 && response.status != 500) {
          app.showError('Error loading subscribers.');
        }
      }
    })
  },

  render: function() {
    this.$('#subscribers').addRows(this.subscribers, function(subscriber) {
      return ich.SubscriberCardView(subscriber.attributes);
    }, 4);
    return this;
  }
});

var SubscriberView = Backbone.View.extend({
  mainNavId: 'subscribers',

  initialize: function() {
    var self = this;
    this.model.fetch({
      success: function() {
        self.modelFetched = true;
        self.render();
      }, 
      error: function(model, response) {
        if (response.status != 401 && response.status != 500) {
          app.showE('Error loading subscriber.');
        }
      }
    });
  },

  render: function() {
    if (this.modelFetched) {
      this.$el.empty();
      this.$el.append(ich.SubscriberView(this.model.attributes));
    }
    return this;
  }
});

var ShortcodesView = Backbone.View.extend({
  mainNavId: 'shortcodes',

  initialize: function() {
    this.$el.empty();
    this.$el.append(ich.ShortcodesView());

    var self = this;
    this.shortcodes = new ShortcodeList();
    this.shortcodes.fetch({
      success: function() {
        self.render();
      },
      error: function(model, response) {
        if (response.status != 401 && response.status != 500) {
          app.showE('Error loading shortcodes.');
        }
      }
    })
  },

  render: function() {
    this.$('#shortcodes').addRows(this.shortcodes, function(shortcode) {
      return ich.ShortcodeView(addFilters(shortcode.attributes));
    }, 4);
    return this;
  }
})

var SIMAppletsView = Backbone.View.extend({
  mainNavId: 'applets',

  render: function() {
    this.$el.empty();
    this.$el.append(ich.SIMAppletsView());
    return this;
  }
});

var AccountView = Backbone.View.extend({
  mainNavId: 'account',

  events: {
    'click .logout': 'logout',
    'click .nav li a': 'navClick'
  },

  initialize: function() {
    this.$el.empty();
    this.$el.append(ich.AccountView);

    if (!app.user) {
      this.updateUser()
    }
  },

  navClick: function(event) {
    router.navigate($(event.target).attr('href'), { trigger: true })
    return false;
  },

  render: function() {
    if (app.user) {
      this.$el.find('.number').text(app.user.number);
      this.$el.find('#account-view').show();
    }
    return this;
  },

  setView: function(view) {
    if (this.currentView) {
      if (this.currentView.hidden) {
        this.currentView.hidden();
      }

      this.currentView.remove();
    }

    this.currentView = view;
    this.$el.find('.content').append(view.render().el);
    if (view.shown) {
      view.shown();
    }

    this.$el.find('.nav li').removeClass('active');
    this.$el.find('.nav li#' + this.currentView.accountNavId).addClass('active');
  },

  updateUser: function() {
    var self = this;
    $.jsonGet('/api/me', function(success, data) {
      if (success) {
        app.user = data.user;
        self.render();
      } else {
        app.user = null;
        self.showLogin();
      }
    });
  },

  logout: function() {
    var self = this;

    $.jsonPost('/api/logout', null, function(success, jsonResponse) {
      if (success) {
        app.user = null;
        self.showLogin();
      } else {
        app.showE('Error logging out.');
      }
    });
    return false;
  },

  showLogin: function() {
    app.returnTo = window.location.pathname;
    router.navigate('/account/login', { trigger: true });
  }
});

var AccountShortcodesView = Backbone.View.extend({
  accountNavId: 'apps',

  events: {
    'click #new-shortcode': 'newShortcode'
  },

  initialize: function() {
    this.$el.empty();
    this.$el.append(ich.AccountAppsView({ user: app.user }));

    this.shortcodes = new MyShortcodeList();
    this.shortcodes.bind('add',   this.addOne, this);
    this.shortcodes.bind('reset', this.addAll, this);
    this.shortcodes.bind('all',   this.render, this);

    this.shortcodes.fetch({
      error: function(model, response) {
        if (response.status != 401 && response.status != 500) {
          app.showE('Error loading shortcodes.');
        }
      }
    });
  },

  render: function() {
    this.$el.find('.nav li#apps').addClass('active');
    return this;
  },

  addOne: function(shortcode) {
    var view = new ShortcodeRowView({ model: shortcode });
    this.$('#apps-table tbody').append(view.render().el);
  },

  addAll: function() {
    this.shortcodes.each(this.addOne);
  },

  newShortcode: function() {
   router.navigate('/account/shortcodes/new', { trigger: true });
  }
});

var AccountAppletsView = Backbone.View.extend({
  accountNavId: 'applets'
});

var AccountProfileView = Backbone.View.extend({
  accountNavId: 'profile',

  events: {
    'click #update': 'update',
    'click #cancel': 'cancel'
  },

  initialize: function() {
    var self = this;
    // FIXME: Use a Subscriber object
    $.jsonGet('/api/me', function(success, data) {
      if (success) {
        self.user = data.user;
        self.render();
      } else {
        app.showE('error!!'); // FIXME
      }
    });
  },

  render: function() {
    if (this.user) {
      this.$el.empty();
      this.$el.append(ich.AccountProfileView(this.user));
      this.$el.find('.nav li#profile').addClass('active');
    }
    return this;
  },

  update: function() {
    var params = this.$el.find('form').serializeObject();
    $.jsonPut('/api/me', params, function(success, data, request) {
      if (success) {
        app.showSuccessAlert('Profile updated!');
        router.navigate('/account', { trigger: true });
      } else {
        this.$('form').showValidationErrors(request);
      }
    });
    return false;
  },

  cancel: function() {
    router.navigate('/account', { trigger: true });
    return false;
  }
});

var LoginView = Backbone.View.extend({
  mainNavId: 'account',

  events: {
    'click .submit':   'login',
    'click .register': 'register',
    'click .forgot':   'forgot'
  },

  initialize: function() {
    // FIXME: Doesn't work if the page reloads obviously...
    if (app.user) {
      router.navigate('account', { trigger: true });
    }
  },

  render: function() {
    this.$el.empty();
    this.$el.append(ich.LoginView);
    return this;
  },

  login: function() {
    var params = this.$el.find('form').serializeObject();

    $.jsonPost('/api/login', params, function(success, data) {
      if (success) {
        app.user = data.user;

        var returnTo = (app.returnTo) ? app.returnTo : '/account';
        router.navigate(returnTo, { trigger: true });

        app.returnTo = null;

      } else {
        // FIXME
        alert('Invalid username or password.');
        this.$('input[name=password]').val('');
        this.$('input[name=password]').focus();
      }
    });
    return false;
  },

  register: function() {
    router.navigate('account/register', { trigger: true });
    return false;
  },

  forgot: function() {
    alert('Please stop by the Shadytel booth and a trained (though possibly not sober) service technician will be happy to assist you with a password reset.');
  }
});

var AccountVerifyView = Backbone.View.extend({
  mainNavId: 'account',

  events: {
    'click .submit': 'sendCode',
  },

  sendCode: function() {
    var self = this;

    var params = { number: this.$el.find('.phone').val() };
    $.jsonPost('/api/send_code', params, function(success, data) {
      if (success) {
        app.setView(new AccountRegisterView({ 
          attributes: {
            number: data.number 
          }
        }));
      } else {
        app.showError(data.message);
      }
    });

    return false;
  },

  render: function() {
    this.$el.empty();
    this.$el.append(ich.account_verify);
    return this;
  }
});

var AccountRegisterView = Backbone.View.extend({
  mainNavId: 'account',

  events: {
    'click .submit': 'register'
  },

  register: function() {
    var params = this.$el.find('form').serializeObject();
    $.jsonPost('/api/register', params, function(success, data, request) {
      if (success) {
        router.navigate('account', { trigger: true });
      } else {
        this.$('form').showValidationErrors(request);
      }
    });
    return false;
  },

  render: function() {
    this.$el.empty();
    this.$el.append(ich.account_register(this.attributes));
    return this;
  }
});

var NewShortcodeView = Backbone.View.extend({
  accountNavId: 'apps',

  events: {
    'click #create': 'createApp',
    'click .cancel': 'cancel'
  },

  createApp: function() {
    var self = this;

    var params = this.$el.find('form').serializeObject();
    params.number = params.number_prefix + params.number;
    delete params.number_prefix;

    var shortcode = new MyShortcode(params);
    shortcode._isNew = true; // FIXME
    shortcode.save(null, {
      success: function(model, response) {
        app.showSuccessAlert('Shortcode created!');
        router.navigate('/account/shortcodes', { trigger: true });
      }, 
      error: function(model, response) {
        this.$('form').showValidationErrors(response);
      }
    });
    return false;
  },

  render: function() {
    this.$el.empty();
    this.$el.append(ich.NewShortcodeView());
    return this;
  },

  cancel: function() {
    router.navigate('/account/shortcodes', { trigger: true });
    return false;
  }
});

var EditMyShortcodeView = Backbone.View.extend({
  accountNavId: 'apps',

  events: {
    'click #update': 'updateShortcode',
    'click #delete': 'deleteShortcode',
    'click #cancel': 'cancel'
  },

  initialize: function() {
    var self = this;
    this.model.fetch({ 
      success: function() {
        self.modelFetched = true;
        self.render();
      }, 
      error: function(model, response) {
        if (response.status != 401 && response.status != 500) {
          app.showError('Error loading subscribers.');
        }
      }
    });
  },

  updateShortcode: function() {
    var self = this;

    var params = this.$el.find('form').serializeObject();
    this.model.save(params, {
      success: function(model, response) {
        app.showSuccessAlert('Shortcode updated!');
        router.navigate('/account/shortcodes', { trigger: true });
      }, 
      error: function(model, response) {
        this.$('form').showValidationErrors(response);
      }
    });
    return false;
  },

  deleteShortcode: function() {
    if (confirm("Are you sure?")) {
      this.model.destroy({
        success: function() {
          app.showSuccessAlert('Shortcode deleted.');
          router.navigate('/account/shortcodes', { trigger: true });
        },
        error: function(model, response) {
          app.showError('Failed to delete');
        }
      });
    }
    return false;
  },

  render: function() {
    if (this.modelFetched) {
      this.$el.empty();
      this.$el.append(ich.EditMyShortcodeView(this.model.attributes));
    }
    return this;
  },

  cancel: function() {
    router.navigate('/account/shortcodes', { trigger: true });
    return false;
  }
});

// --- Init!

$(document).ajaxStart(function() {
  window.app.showLoading();
});
$(document).ajaxComplete(function() {
  window.app.hideLoading();
});
$(document).ajaxError(function(e, jqxhr, settings, exception) {
  if (jqxhr.status == 401) {
    if (!(app.currentView instanceof LoginView)) {
      app.setView(new LoginView());
    }
  } else if (jqxhr.status == 500) {
    app.showError("Application error.");
  }
});

$(function () {
  window.router = new ShadyRouter();
  window.app    = new AppView();  
  Backbone.history.start({ pushState: true });
});

jQuery.fn.addRows = function(models, viewFunc, numCols) {
  var self = this;
  $(this).empty();
  var row;
  var i = 0;
  models.each(function (model) {
    if ((i % numCols) == 0) {
      row = $('<div>').addClass('row-fluid');
      $(self).append(row);
    }
    row.append(viewFunc(model));
    i++;
  });
  $(this).pintristify();
  return this;
};

jQuery.fn.pintristify = function() {
  var self = this;
  var go = function() {
    var childOffsets = {};
    $('.row, .row-fluid', this).each(function(rowIndex, row) {
      $(row).children().each(function(childIndex, child) {
        if ($(child).css('float') != 'none' && childOffsets[childIndex]) {
          $(child)
            .css('position', 'relative')
            .css('top', '-' + (childOffsets[childIndex] /* ?? */) + 'px');
        } else {
          $(child).css('position', '').css('top', '');
        }
        var offset = $(row).outerHeight() - $(child).outerHeight({ includeMargin: true });
        if (!childOffsets[childIndex]) {
          childOffsets[childIndex] = offset;
        } else {
          childOffsets[childIndex] += offset;
        }
      });
    });
  }
  go.apply(self);
  $(window).resize(function() { go.apply(self); });
}

jQuery.fn.serializeObject = function() {
  var arrayData, objectData;
  arrayData = this.serializeArray();
  objectData = {};

  $.each(arrayData, function() {
    var value;

    if (this.value != null) {
      value = this.value;
    } else {
      value = '';
    }

    if (objectData[this.name] != null) {
      if (!objectData[this.name].push) {
        objectData[this.name] = [objectData[this.name]];
      }

      objectData[this.name].push(value);
    } else {
      objectData[this.name] = value;
    }
  });

  return objectData;
};

jQuery.fn.showValidationErrors = function(response) {
  $('.control-group.error', this).removeClass('error');
  $('.help-inline.error', this).remove();

  var self = this;

  if (response.getResponseHeader('Content-Type') === 'application/json') {
    var json = JSON.parse(response.responseText);

    var foundInput = false;
    _.each(json.errors, function(errors, name) {
      var group = $('[name=' + name + ']', self).closest('.control-group');
      group.addClass('error');
      group.find('.controls input, .controls textarea').last().after($('<span>').addClass('help-inline').addClass('error').text(errors.join(', ')));
      if (group.length > 0) {
        foundInput = true;
      }
    });

    if (foundInput) {
      return;
    }
  }

  app.showError('error'); // FIXME
};

(function($) {
  // FIXME: DRY...

  $.jsonGet = function(url, callback) {
    $.jsonRequest({
      url:      url,
      type:    'GET',
      success: function(jsonResponse) { callback(true,  jsonResponse); },
      error:   function(jsonResponse, request) { callback(false, jsonResponse, request); }
    });
  };

  $.jsonPost = function(url, data, callback) {
    $.jsonRequest({
      url:     url,
      type:    'POST',
      data:    data,
      success: function(jsonResponse) { callback(true,  jsonResponse); },
      error:   function(jsonResponse, request) { callback(false, jsonResponse, request); }
    });
  };

  $.jsonPut = function(url, data, callback) {
    $.jsonRequest({
      url:     url,
      type:    'PUT',
      data:    data,
      success: function(jsonResponse) { callback(true,  jsonResponse); },
      error:   function(jsonResponse, request) { callback(false, jsonResponse, request); }
    });
  };

  $.jsonRequest = function(options){
    var successCb = options.success;
    var errorCb   = options.error;

    options.success = function(jsonResponse){
      // FIXME: Nothing else to do here?
      successCb(jsonResponse);
    };
    
    options.error = function(request, textStatus){
      if (request.getResponseHeader('Content-Type') === 'application/json') {
        var jsonResponse = JSON.parse(request.responseText);
        errorCb(jsonResponse, request);
      } else {
        errorCb(null, request);
      }
    };
    
    $.ajax(options);
  };
})(jQuery);

function addFilters(obj) {
  return _.extend(obj, {
    simple_format: function() {
      var data = this;
      return function(text) {
        return simpleFormat(Mustache.render(text, data));
      }
    }
  });
}

function simpleFormat(str) {
  str = str.replace(/\r\n?/, "\n");
  str = $.trim(str);
  if (str.length > 0) {
    str = str.replace(/\n\n+/g, '</p><p>');
    str = str.replace(/\n/g, '<br />');
    str = '<p>' + str + '</p>';
  }
  return str;
}