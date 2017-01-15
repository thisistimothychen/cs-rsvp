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




/**
 * Primary app routes.
 */
// app.get('/', homeController.index);
// app.get('/login', userController.getLogin);
// app.post('/login', userController.postLogin);
// app.get('/logout', userController.logout);
app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);
app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);
app.get('/signup', userController.getSignup);
app.post('/signup', userController.postSignup);
app.get('/contact', contactController.getContact);
app.post('/contact', contactController.postContact);
app.get('/account', passportConfig.isAuthenticated, userController.getAccount);
app.post('/account/profile', passportConfig.isAuthenticated, userController.postUpdateProfile);
app.post('/account/password', passportConfig.isAuthenticated, userController.postUpdatePassword);
app.post('/account/delete', passportConfig.isAuthenticated, userController.postDeleteAccount);
app.get('/account/unlink/:provider', passportConfig.isAuthenticated, userController.getOauthUnlink);



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
  if (roles.length == 0) {
    if (req.session.cas_username == null) {
      // Not logged in
      // Universally accessible page; don't need permissions
      res.render(pageToRender, {username: req.session.cas_username}); // TODO do we need the username for unsecured pages?
    } else {
      // Logged in
      // Lookup the user in the DB based on CAS username
      User.findOne({username: req.session.cas_username}, function(err, user) {
        console.log("Finding user");
        
        if (!user) {
          // First time login; CREATE NEW USER AT PROFILE PAGE
          res.render('profile.ejs', {user: user, username: req.session.cas_username});
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
          res.render('profile.ejs', {user: user, username: req.session.cas_username});
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


// index page 
app.get('/', function(req, res) {
  checkPermissions(req, res, 'index.ejs', []);
});

// profile page
app.get('/profile', function(req, res) {
  console.log("GET /profile");
  checkPermissions(req, res, 'profile.ejs', ['User']);
});

// create a new user
app.post('/profile', function(req,res) {
  // TODO update the way of checking permissions
  // checkPermissions(req, res, 'profile.ejs', ['User']);
  User.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
  	username: req.session.cas_username,
  	email: req.body.email,
  	roles: {
  		type: {
  			user: true,
  			admin: false,
  			superuser: false
  		}
  	},
  	// resume: 
  	major: 'Undefined',
  	class: 'Undefined'
  }, function (err, user) {
       if (err) {
           res.send("There was a problem creating the user: " + err);
       } else {
           // User has been created
           console.log('POST creating new user: ' + user);
           res.format({
             //HTML response will set the location and redirect back to the home page. You could also create a 'success' page if that's your thing
             html: function(){
                //  // If it worked, set the header so the address bar doesn't still say /adduser
                //  res.location("user");
                // And forward to success page
                res.redirect("/");
             },
             //JSON response will show the newly created user
             json: function(){
                res.json(user);
             }
         });
       }
  })
});

// upodate existing user
app.post('/update_profile', function(req,res) {
  // TODO update the way of checking permissions
  // checkPermissions(req, res, 'profile.ejs', ['User']);
  console.log('UPDATE PROFILE')
  User.update(req.body.user, {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
  	username: req.session.cas_username,
  	email: req.body.email,
  	roles: {
  		type: {
  			user: true,
  			admin: false,
  			superuser: false
  		}
  	},
  	// resume: 
  	major: 'Undefined',
  	class: 'Undefined'
  }, function (err, user) {
       if (err) {
           res.send("There was a problem updating the user: " + err);
       } else {
           // User has been created
           console.log('POST updating new user: ' + user);
           res.format({
             //HTML response will set the location and redirect back to the home page. You could also create a 'success' page if that's your thing
             html: function(){
                //  // If it worked, set the header so the address bar doesn't still say /adduser
                //  res.location("user");
                // And forward to success page
                req.flash("info", "Your profile has been updated.");
                res.redirect("/profile");
             },
             //JSON response will show the newly created user
             json: function(){
                res.json(user);
             }
         });
       }
  })
});


// new event page
app.get('/create_event', function(req, res) {
  console.log("GET /create_event");
  // TODO remove 'User' role
  checkPermissions(req, res, 'new_event.ejs', ['User', 'Admin', 'Superuser']);
});




/**
 * API examples routes.
 */
app.get('/api', apiController.getApi);
app.get('/api/lastfm', apiController.getLastfm);
app.get('/api/nyt', apiController.getNewYorkTimes);
app.get('/api/aviary', apiController.getAviary);
app.get('/api/steam', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getSteam);
app.get('/api/stripe', apiController.getStripe);
app.post('/api/stripe', apiController.postStripe);
app.get('/api/scraping', apiController.getScraping);
app.get('/api/twilio', apiController.getTwilio);
app.post('/api/twilio', apiController.postTwilio);
app.get('/api/clockwork', apiController.getClockwork);
app.post('/api/clockwork', apiController.postClockwork);
app.get('/api/foursquare', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getFoursquare);
app.get('/api/tumblr', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getTumblr);
app.get('/api/facebook', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getFacebook);
app.get('/api/github', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getGithub);
app.get('/api/twitter', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getTwitter);
app.post('/api/twitter', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.postTwitter);
app.get('/api/linkedin', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getLinkedin);
app.get('/api/instagram', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getInstagram);
app.get('/api/paypal', apiController.getPayPal);
app.get('/api/paypal/success', apiController.getPayPalSuccess);
app.get('/api/paypal/cancel', apiController.getPayPalCancel);
app.get('/api/lob', apiController.getLob);
app.get('/api/upload', apiController.getFileUpload);
app.post('/api/upload', upload.single('myFile'), apiController.postFileUpload);
app.get('/api/pinterest', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getPinterest);
app.post('/api/pinterest', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.postPinterest);
app.get('/api/google-maps', apiController.getGoogleMaps);

/**
 * OAuth authentication routes. (Sign in)
 */
app.get('/auth/instagram', passport.authenticate('instagram'));
app.get('/auth/instagram/callback', passport.authenticate('instagram', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'user_location'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/github', passport.authenticate('github'));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/google', passport.authenticate('google', { scope: 'profile email' }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/linkedin', passport.authenticate('linkedin', { state: 'SOME STATE' }));
app.get('/auth/linkedin/callback', passport.authenticate('linkedin', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});

/**
 * OAuth authorization routes. (API examples)
 */
app.get('/auth/foursquare', passport.authorize('foursquare'));
app.get('/auth/foursquare/callback', passport.authorize('foursquare', { failureRedirect: '/api' }), (req, res) => {
  res.redirect('/api/foursquare');
});
app.get('/auth/tumblr', passport.authorize('tumblr'));
app.get('/auth/tumblr/callback', passport.authorize('tumblr', { failureRedirect: '/api' }), (req, res) => {
  res.redirect('/api/tumblr');
});
app.get('/auth/steam', passport.authorize('openid', { state: 'SOME STATE' }));
app.get('/auth/steam/callback', passport.authorize('openid', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/pinterest', passport.authorize('pinterest', { scope: 'read_public write_public' }));
app.get('/auth/pinterest/callback', passport.authorize('pinterest', { failureRedirect: '/login' }), (req, res) => {
  res.redirect('/api/pinterest');
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
