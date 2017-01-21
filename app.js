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
const sass = require('node-sass-middleware');
const multer = require('multer');

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
app.use(sass({
  src: path.join(__dirname, 'public'),
  dest: path.join(__dirname, 'public')
}));
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

// Moment.js
var moment = require('moment');
moment().format();



// Initialize database paths
let User = require(path.resolve('./models/User'));

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
  console.log(roles.length);
  if (roles.length == 0) {
    if (req.session.cas_username == null) {
      // Not logged in
      // Universally accessible page; don't need permissions
      res.render(pageToRender, {username: req.session.cas_username}); // TODO do we need the username for unsecured pages?
    } else {
      // Logged in
      // Lookup the user in the DB based on CAS username
      User.findOne({username: req.session.cas_username}, function(user, err) {
        console.log("Finding user");
        
        if (!user) {
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
      User.findOne({username: req.session.cas_username}, function(user, err) {
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
}



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
      User.findOne({username: req.session.cas_username}, function(user, err) {
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
      User.findOne({username: req.session.cas_username}, function(user, err) {
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
}





// index page 
app.get('/', function(req, res) {
  checkPermissions(req, res, 'index.ejs', []);
});

// profile page
app.get('/profile', function(req, res) {
  console.log("GET /profile");
  checkPermissions(req, res, 'profile.ejs', ['User']);
});

// update existing user
app.post('/update_profile', function(req, res) {
  checkPermissionsWithCallback(req, res, function(params) {
    userProfileController.update(req, res);
    console.log("Updating user: " + req.toString());
    res.render('index.ejs', params);
  }, ['User']);
});


// new event page
app.get('/create_event', function(req, res) {
  console.log("GET /create_event");
  // TODO remove 'User' role
  checkPermissions(req, res, 'new_event.ejs', ['User', 'Admin', 'Superuser']);
});



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
