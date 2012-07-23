var ShadyRouter = Backbone.Router.extend({
  routes: {
    '':                'status',
    'status':          'status',
    'shortcodes':      'shortcodes',
    'directory':       'directory',
    'account':         'accountApps',
    'account/apps':    'accountApps',
    'account/profile': 'accountProfile'
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

  accountApps: function() {
    app.setView(new AccountShortcodesView());
  },

  accountProfile: function() {
    app.setView(new AccountProfileView());
  }
});

var Shortcode = Backbone.Model.extend({
});

var ShortcodeList = Backbone.Collection.extend({
  model: Shortcode,
  url: '/api/shortcodes'
});

var ShortcodeView = Backbone.View.extend({
  tagName: 'li',

  events: {

  },

  initialize: function() {
    this.model.bind('change',  this.render, this);
    this.model.bind('destroy', this.remove, this);
  },

  render: function() {
    // FIXME
  }
});

var AppView = Backbone.View.extend({
  events: {
  },

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

var ShortcodesView = Backbone.View.extend({
  mainNavId: 'shortcodes',

  render: function() {
    this.$el.html('Put shortcodes directory here');
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

var AccountShortcodesView = Backbone.View.extend({
  mainNavId: 'account',

  initialize: function() {
    this.shortcodes = new ShortcodeList();
    this.shortcodes.bind('add',   this.addOne, this);
    this.shortcodes.bind('reset', this.addAll, this);
    this.shortcodes.bind('all',   this.render, this);

    app.showLoading();

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
    if (false) { // FIXME: If logged in...
      this.$el.html(ich.AccountView());
    }
    return this;
  },

  addOne: function(shortcode) {
    var view = new ShortcodeView({ model: shortcode });
    this.$('#shortcode-list').append(view.render().el);
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
        if (response.status == 401) {
          window.app.showLogin();
        }
      }
    });
  }
})

var LoginView = Backbone.View.extend({
  mainNavId: 'account',

  events: {
    'click .submit':   'login',
    'click .register': 'register',
    'click .forgot':   'forgot'
  },

  initialize: function() {

  },

  render: function() {
    this.$el.html(ich.LoginView);
    return this;
  },

  login: function() {
    window.app.showLoading();

    var params = this.$el.find('form').serializeObject();

    $.post('/api/login', params, function() {
      window.app.loadShortcodes();
    }).error(function() {
      alert('Login Failed');
    })
    .complete(function() {
      window.app.hideLoading();
    });

    return false;
  },

  register: function() {
    window.app.setView(new RegisterView());
    return false;
  },

  forgot: function() {
    alert('Please stop by the Shadytel booth and a trained (and possibly sober) service technician will be happy to assist you with a password reset.');
  }
});

var RegisterView = Backbone.View.extend({
  mainNavId: 'account',

  events: {
    'click .step1 .submit': 'getCode',
    'click .step2 .submit': 'register'
  },

  getCode: function() {
    window.app.showLoading();

    var self = this;

    var params = { number: this.$el.find('.phone').val() };
    $.post('/api/send_code', params, function() {
      self.$el.find('.step1').hide();
      self.$el.find('.step2').show();
    })
    .error(function() {
      alert('error');
    })
    .complete(function() {
      window.app.hideLoading();
    });

    return false;
  },

  register: function() {
    return false;
  },

  render: function() {
    this.$el.html(ich.RegisterView);
    return this;
  }
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