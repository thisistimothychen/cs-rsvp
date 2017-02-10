/**
 * Module dependencies.
 */
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const bodyParser = require('body-parser');
const logger = require('morgan');
const chalk = require('chalk');
const errorHandler = require('errorhandler');
// const lusca = require('lusca');
const dotenv = require('dotenv');
const MongoStore = require('connect-mongo')(session);
const flash = require('express-flash');
const path = require('path');
const mongoose = require('mongoose');
const passport = require('passport');
const expressValidator = require('express-validator');
const expressStatusMonitor = require('express-status-monitor');
const multer = require('multer');
const _ = require('lodash');
const q = require('q');

const upload = multer({ dest: path.join(__dirname, 'uploads') });

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.load({ path: '.env.example' });

/**
 * Controllers (route handlers).
 */
const homeController = require('./controllers/home');
const userController = require('./controllers/user');
const apiController = require('./controllers/api');
const contactController = require('./controllers/contact');
const cas_loginController = require('./controllers/cas_login');
const userProfileController = require('./controllers/users.profile.server.controller');
const eventController = require('./controllers/events.server.controller');
const eventsService = require('./services/events.server.service.js')();

/**
 * API keys and Passport configuration.
 */
const passportConfig = require('./config/passport');

/**
 * Create Express server.
 */
const app = express();

/**
 * Connect to MongoDB.
 */
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI);
mongoose.connection.on('error', () => {
  console.log('%s MongoDB connection error. Please make sure MongoDB is running.', chalk.red('✗'));
  process.exit();
});

/**
 * Express configuration.
 */
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressStatusMonitor());
app.use(compression());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());
app.use(session({
  cookieName: 'session',
  duration: 30 * 60 * 1000,
  activeDuration: 5 * 60 * 1000,
  httpOnly: true,   // Prevents browser JavaScript from accessing cookies
  secure: true,     // Ensures cookies are only used over HTTPS
  ephemeral: true,  // Deletes the cookie when the browser is closed
  resave: true,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET,
  store: new MongoStore({
    url: process.env.MONGODB_URI || process.env.MONGOLAB_URI,
    autoReconnect: true
  })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
// app.use((req, res, next) => {
//   if (req.path === '/api/upload') {
//     next();
//   } else {
//     lusca.csrf()(req, res, next);
//   }
// });
// app.use(lusca.xframe('SAMEORIGIN'));
// app.use(lusca.xssProtection(true));
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});
app.use((req, res, next) => {
  // After successful login, redirect back to the intended page
  if (!req.user &&
      req.path !== '/login' &&
      req.path !== '/signup' &&
      !req.path.match(/^\/auth/) &&
      !req.path.match(/\./)) {
    req.session.returnTo = req.path;
  } else if (req.user &&
      req.path == '/account') {
    req.session.returnTo = req.path;
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));
app.use(express.static(path.join(__dirname, 'uploads')));

// Moment.js
let moment = require('moment');
moment().format();



// Initialize database paths
let User = require(path.resolve('./models/User'));
let Event = require(path.resolve('./models/Event'));

app.get('/cas_login', cas_loginController.cas_login);
app.get('/logout', cas_loginController.cas_logout);
// use res.render to load up an ejs view file

/**
 * Call to check authentication and permissions/user roles
 *
 * @param {String} pageToRender
 *      The route to render to. E.g. 'profile.ejs'
 * @param {Array} roles
 *      Empty array for universally accessible page
 *      String array for roles allowed to access the pageToRender
 */
let checkPermissions = function(req, res, pageToRender, roles) {
  if (roles.length == 0) {
    if (req.session.cas_username == null) {
      console.log("Not logged in");
      // Not logged in
      // Universally accessible page; don't need permissions
      res.render(pageToRender, {username: req.session.cas_username}); // TODO do we need the username for unsecured pages?
    } else {
      // Logged in
      // Lookup the user in the DB based on CAS username
      User.findOne({username: req.session.cas_username}, function(err, user) {
        console.log("Finding user " + req.session.cas_username + " in database");

        if (!user) {
          console.log("User " + req.session.cas_username + " not found")
          // First time login; CREATE NEW USER AT PROFILE PAGE
          userProfileController.create(req, res);
        } else {
          console.log("Found user");
          res.render(pageToRender, {user: user, username: user.username});
          return;
        }
      });
    }
  } else {
    // Need to check permissions
    console.log("Checking permissions");

    // Check if session exists
    if (req.session && req.session.cas_username) {
      // Lookup the user in the DB based on CAS username
      User.findOne({username: req.session.cas_username}, function(err, user) {
        console.log("Finding user");

        if (!user) {
          // First time login; CREATE NEW USER AT PROFILE PAGE
          userProfileController.create(req, res);
          // res.render('profile.ejs', {user: user, username: req.session.cas_username});
        } else {
          console.log("Found user");

          // User has been created already; check permissions
          for (var i = 0; i < roles.length; i++) {
            // TODO check database text-search index compatibility
            if (roles[i] == "User" && user.roles.type.user ||
                roles[i] == "Admin" && user.roles.type.admin ||
                roles[i] == "Superuser" && user.roles.type.superuser) {
              res.render(pageToRender, {user: user, username: user.username});
              return;
            }
          }

          // No permission to view pageToRender
          req.flash('danger', 'Sorry, you have insufficient user privileges to access the ' + pageToRender.substring(0, pageToRender.length - 4) + ' page.');
          res.redirect('/');
        }
      });
    } else {
      res.redirect('/cas_login');
    }
  }
};



/**
 * Call to check authentication and permissions/user roles
 *
 * @param {Function} callback
 *      Callback function that takes in JSON object (parameters to pass to view)
 * @param {Array} roles
 *      Empty array for universally accessible page
 *      String array for roles allowed to access the pageToRender
 */
let checkPermissionsWithCallback = function(req, res, callback, roles) {
  if (roles.length == 0) {
    if (req.session.cas_username == null) {
      // Not logged in
      // Universally accessible page; don't need permissions
      callback({username: req.session.cas_username});
    } else {
      // Logged in
      // Lookup the user in the DB based on CAS username
      User.findOne({username: req.session.cas_username}, function(err, user) {
        console.log("Finding user");

        if (!user) {
          // First time login; CREATE NEW USER AT PROFILE PAGE
          userProfileController.create(req, res);
        } else {
          console.log("Found user");
          callback({user: user, username: user.username});
        }
      });
    }

  } else {
    // Need to check permissions
    console.log("Checking permissions");

    // Check if session exists
    if (req.session && req.session.cas_username) {
      // Lookup the user in the DB based on CAS username
      User.findOne({username: req.session.cas_username}, function(err, user) {
        console.log("Finding user");

        if (!user) {
          // First time login; CREATE NEW USER AT PROFILE PAGE
          userProfileController.create(req, res);
        } else {
          console.log("Found user");

          // User has been created already; check permissions
          for (var i = 0; i < roles.length; i++) {
            // TODO check database text-search index compatibility
            if (roles[i] == "User" && user.roles.type.user ||
                roles[i] == "Admin" && user.roles.type.admin ||
                roles[i] == "Superuser" && user.roles.type.superuser) {
              callback({user: user, username: user.username});
              return;
            }
          }

          // No permission to view pageToRender
          req.flash('danger', 'Sorry, you have insufficient user privileges to access the ' + pageToRender.substring(0, pageToRender.length - 4) + ' page.');
          res.redirect('/');
        }
      });
    } else {
      res.redirect('/cas_login');
    }
  }
};



// index page
app.get('/', function(req, res) {
  checkPermissionsWithCallback(req, res, function(params) {
    let search = {};
    if (req.query.text) {
      search.$text = { $search: req.query.text };
    }

    if (req.query.tags) {
      if (typeof req.query.tags !== 'string') {
        search['tags'] = { $all: [req.query.tags]};
      } else {
        search['tags'] = { $all: req.query.tags.split(',')};
      }
    }

    let filteredEventsPromise = eventsService.searchEvents(search);
    let tagsPromise = eventsService.searchEvents({}, {tags: 1});

    q.allSettled([filteredEventsPromise, tagsPromise]).spread((filteredEvents, tags) => {
	    params.allEvents = filteredEvents.value.elements;
	    params.getDateTimeStr = getDateTimeStr;
	    params.getDateTimePrettyFormat = getDateTimePrettyFormat;
	    params.sameDate = sameDate;

	    // get list of all unique tags
	    let tagsOnly = tags.value.elements.map((event) => event.tags);
	    params.tags = _.uniq(_.flatten(tagsOnly));

	    res.render('index.ejs', params);
    });
  }, []);
});

// profile page
app.get('/profile', function(req, res) {
  console.log("GET /profile");
  checkPermissions(req, res, 'profile.ejs', ['User', 'Admin', 'Superuser']);
});

// update existing user
app.post('/profile', upload.single('resume'), function(req, res) {
  checkPermissionsWithCallback(req, res, function(params) {
    console.log("Updating user " + req.session.cas_username);
    userProfileController.update(req, res);
  }, ['User', 'Admin', 'Superuser']);
});

app.get('/download_resume', function(req, res) {
  checkPermissionsWithCallback(req, res, (params) => {
	  User.findOne({username: req.session.cas_username}, function(err, user) {
	    if (user.resume) {
	      res.download(user.resume.type.filepath, user.resume.type.originalName);
        } else {
	      res.status(400).json('No resume!');
        }
	  });
  }, ['User']);
});

// grant user admin privileges
app.post('/users/:username/adminify', function(req, res) {
  checkPermissionsWithCallback(req, res, function(params) {
    console.log("Upgrading " + req.params.username + " to admin status");
    userProfileController.adminify(req, res);
  }, ['Superuser']);
});

// revoke user admin privileges
app.post('/users/:username/unadminify', function(req, res) {
  checkPermissionsWithCallback(req, res, function(params) {
    console.log("Downgrading " + req.params.username + " to regular user status");
    userProfileController.unadminify(req, res);
  }, ['Superuser']);
});



// view event creation page
app.get('/create_event', function(req, res) {
  console.log("GET /create_event");
  // TODO remove 'User' role
  checkPermissions(req, res, 'event_form.ejs', ['Admin', 'Superuser']);
});

// create new event
app.post('/event', function(req, res) {
  checkPermissionsWithCallback(req, res, function(params) {
    console.log("Creating event");
    eventController.create(req, res);
  }, ['Admin', 'Superuser']);
});

// show event edit page (admin view)
app.get('/event/:id/edit', function(req, res) {
  checkPermissionsWithCallback(req, res, function(params) {
    Event.findOne({ _id: req.params.id })
      .then(function(event) {
        params.event = event;
        params.startDateTimeStr = getDateTimeStr(event.startTime);
        params.endDateTimeStr = getDateTimeStr(event.endTime);
        params.duplicate = false;
        res.render('event_form.ejs', params);
      });
  }, ['Admin', 'Superuser']);
});

// show event edit page (admin view)
app.get('/event/:id/duplicate', function(req, res) {
  checkPermissionsWithCallback(req, res, function(params) {
    Event.findOne({ _id: req.params.id })
      .then(function(event) {
        params.event = event;
        params.startDateTimeStr = getDateTimeStr(event.startTime);
        params.endDateTimeStr = getDateTimeStr(event.endTime);
        params.duplicate = true;
        res.render('event_form.ejs', params);
      });
  }, ['Admin', 'Superuser']);
});

// show event
app.get('/event/:id', function(req, res) {
  checkPermissionsWithCallback(req, res, function(params) {
    Event.findOne({ _id: req.params.id })
      .then(function(event) {
        params.event = event;
        params.startDateTimeStr = getDateTimeStr(event.startTime);
        params.endDateTimeStr = getDateTimeStr(event.endTime);
        params.getDateTimeStr = getDateTimeStr;
        params.getDateTimePrettyFormat = getDateTimePrettyFormat;
        params.sameDate = sameDate;
        res.render('event_show.ejs', params);
      });
  }, []);
});

// user rsvp to event
app.post('/event/:id/rsvp', function(req, res) {
  checkPermissionsWithCallback(req, res, function(params) {
    console.log("RSVPing " + req.session.cas_username + " to event " + req.params.id);
    eventController.userRSVP(req, res);
  }, ['User', 'Admin', 'Superuser']);
});

// user unrsvp to event
app.post('/event/:id/unrsvp', function(req, res) {
  checkPermissionsWithCallback(req, res, function(params) {
    console.log("Un-RSVPing " + req.session.cas_username + " from event " + req.params.id);
    eventController.userUnRSVP(req, res);
  }, ['User', 'Admin', 'Superuser']);
});

// edit existing event
app.post('/event/:id/edit', function(req, res) {
  checkPermissionsWithCallback(req, res, function(params) {
    console.log("Updating event " + req.params.id);
    eventController.update(req, res);
  }, ['Admin', 'Superuser']);
});

// delete event
app.post('/event/:id/delete', function(req, res) {
  checkPermissionsWithCallback(req, res, function(params) {
    console.log("Deleting event " + req.params.id);
    eventController.delete(req, res);
  }, ['Admin', 'Superuser']);
});



// show all users page (admin view)
app.get('/users', function(req, res) {
  checkPermissionsWithCallback(req, res, function(params) {
    User.find({})
    .then(function(allUsers) {
      params.allUsers = allUsers;
      res.render('users_show.ejs', params);
    })
  }, ['Admin', 'Superuser']);
});




function getDateTimeStr(mili) {
  var rawDate = new Date(mili);
  rawDate.setTime(rawDate - rawDate.getTimezoneOffset()*60*1000);
  var rawDateStr = rawDate.toJSON();

  // Get AM/PM
  var AmPm = "AM";
  if (rawDate.getUTCHours() > 12) {
    AmPm = "PM";
  }

  dateStr = rawDateStr.substr(5,2) + "/" + rawDateStr.substr(8,2) + "/" + rawDateStr.substr(0,4) + " " + rawDateStr.substr(11,5) + " " + AmPm;
  return dateStr;
}

function getDateTimePrettyFormat(mili) {
  var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var rawDate = new Date(mili);
  rawDate.setTime(rawDate - rawDate.getTimezoneOffset()*60*1000);
  var rawDateStr = rawDate.toJSON();

  // Get AM/PM
  var AmPm = "AM";
  var hours = rawDate.getUTCHours();
  if (rawDate.getUTCHours() > 12) {
    AmPm = "PM";
    hours -= 12;
  } else if (rawDate.getUTCHours() == 0) {
    hours = 12;
  }

  return days[rawDate.getDay()] + " " + months[rawDate.getMonth()] + " " + rawDate.getDate() + ", " + rawDate.getFullYear() + " " + hours + ":" + rawDateStr.substr(14,2) + " " + AmPm;
}

/*
 * Returns true if the two dates are the same date (different times)
 */
function sameDate(date1, date2) {
  if (date1.getDate() == date2.getDate() && date1.getMonth() == date2.getMonth() && date1.getYear() == date2.getYear()) {
    return true;
  } else {
    return false;
  }
}



/**
 * Error Handler.
 */
app.use(errorHandler());

/**
 * Start Express server.
 */
app.listen(app.get('port'), () => {
  console.log('%s App is running at http://localhost:%d in %s mode', chalk.green('✓'), app.get('port'), app.get('env')); 
  console.log('  Press CTRL-C to stop\n');
});

module.exports = app;
