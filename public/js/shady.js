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
    '':                     'status',
    'status':               'status',
    'shortcodes':           'shortcodes',
    'directory':            'directory',
    'applets':              'applets',
    'account':              'accountApps',
    'account/login':        'accountLogin',
    'account/register':     'accountRegister',
    'account/apps':         'accountApps',
    'account/applets':      'accountApplets',
    'account/apps/new':     'accountAppsNew',
    'account/apps/:number': 'accountApp',
    'account/profile':      'accountProfile'
  },

  status: function() {
    app.setView(new StatusView());
  },

  shortcodes: function() {
    app.setView(new ShortcodesView());
  },

  directory: function() {
    app.setView(new DirectoryView());
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
    var shortcode = new Shortcode(number);
    setAccountView(new ShortcodeView({ model: shortcode }));
  },

  accountProfile: function() {
    setAccountView(new AccountProfileView());
  }
});

var Shortcode = Backbone.Model.extend({
});

var ShortcodeList = Backbone.Collection.extend({
  model: Shortcode,
  url: '/api/shortcodes'
});

var ShortcodeRowView = Backbone.View.extend({
  tagName: 'tr',

  events: {

  },

  initialize: function() {
    this.model.bind('change',  this.render, this);
    this.model.bind('destroy', this.remove, this);
  },

  render: function() {
    this.$el.html('<td>foo</td>');
    return this;
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
    this.hideLoading();

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
  }
});

var StatusView = Backbone.View.extend({
  mainNavId: 'status',

  render: function() {
    this.$el.html(ich.StatusView);
    return this;
  }
});

var DirectoryView = Backbone.View.extend({
  mainNavId: 'directory',

  render: function() {
    this.$el.html('Put subscriber directory here');
    return this;
  }
});

var ShortcodesView = Backbone.View.extend({
  mainNavId: 'shortcodes'
})

var SIMAppletsView = Backbone.View.extend({
  mainNavId: 'applets'
});

var AccountView = Backbone.View.extend({
  mainNavId: 'account',

  events: {
    'click .logout': 'logout',
    'click .nav li a': 'navClick'
  },

  initialize: function() {
    this.$el.html(ich.AccountView);

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
      this.$el.find('.number').html(app.user.number);
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
    $.get('/api/me', function(data) {
      app.user = data.user;
      self.render();
    })
    .error(function() {
      app.user = null;
      self.showLogin();
    });
  },

  logout: function() {
    var self = this;

    $.post('/api/logout', function() {
      app.user = null;
      self.showLogin();
    })
    .error(function() {
      alert('error');
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
    this.$el.html(ich.AccountAppsView({ user: app.user }));

    this.shortcodes = new ShortcodeList();
    this.shortcodes.bind('add',   this.addOne, this);
    this.shortcodes.bind('reset', this.addAll, this);
    this.shortcodes.bind('all',   this.render, this);

    this.shortcodes.fetch({
      success: function (collection, response) {
        // FIXME: Hide loading
        // FIXME: Show content
      },
      error: function (collection, response) {
        if (response.status == 401) {
          app.setView(new LoginView());
        } else {
          alert('error');
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

  loadShortcodes: function() {
    this.shortcodes.fetch({ 
      success: function (collection, response) {
        // FIXME: Hide loading
        // FIXME: Show content
      },
      error: function (collection, response) {
        alert('aahahh');
        if (response.status == 401) {
          // FIXME
        }
      }
    });
  },

  newShortcode: function() {
   router.navigate('/account/apps/new', { trigger: true });
  }
});

var AccountAppletsView = Backbone.View.extend({
  accountNavId: 'applets'
});

var AccountProfileView = Backbone.View.extend({
  accountNavId: 'profile',

  render: function() {
    this.$el.html(ich.AccountProfileView({ user: app.user }));
    this.$el.find('.nav li#profile').addClass('active');
    return this;
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
    this.$el.html(ich.LoginView);
    return this;
  },

  login: function() {
    var params = this.$el.find('form').serializeObject();

    $.post('/api/login', params, function(data) {
      app.user = data.user;

      var returnTo = (app.returnTo) ? app.returnTo : '/account';
      router.navigate(returnTo, { trigger: true });

      app.returnTo = null;

    }).error(function() {
      alert('Login Failed');
    });
    return false;
  },

  register: function() {
    router.navigate('account/register', { trigger: true });
    return false;
  },

  forgot: function() {
    alert('Please stop by the Shadytel booth and a trained (and possibly sober) service technician will be happy to assist you with a password reset.');
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
    $.post('/api/send_code', params, function() {
      app.setView(new AccountRegisterView({ attributes: params }));
    })
    .error(function(req, status, err) {
      alert(req.responseText); // FIXME
    });

    return false;
  },

  render: function() {
    this.$el.html(ich.account_verify);
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
    $.post('/api/register', params, function() {
      router.navigate('account', { trigger: true });
    })
    .error(function(req, status, err) {
      alert('failed!');
    });
    return false;
  },

  render: function() {
    this.$el.html(ich.account_register(this.attributes));
    return this;
  }
});

var NewShortcodeView = Backbone.View.extend({
  accountNavId: 'apps',

  events: {
    'click #create': 'createApp'
  },

  createApp: function() {
    var params = this.$el.find('form').serializeObject();
    $.post('/api/shortcodes/create', params, function(response) {
      // FIXME: Show an "app was created!" flash message
      router.navigate('/account/apps/' + response.number);
    })
    .error(function(req, status, err) {
      alert('failed!');
    });
    return false;
  },

  render: function() {
    this.$el.html(ich.NewShortcodeView());
    return this;
  }
});

var ShortcodeView = Backbone.View.extend({
  accountNavId: 'apps',

  events: {

  },

  render: function() {
    this.$el.html(ich.ShortcodeView(this.attributes));
  }
});

// --- Init!

$(document).ajaxStart(function() {
  window.app.showLoading();
});
$(document).ajaxComplete(function() {
  window.app.hideLoading();
});

$(function () {
  window.router = new ShadyRouter();
  window.app    = new AppView();  
  Backbone.history.start({ pushState: true });
});

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