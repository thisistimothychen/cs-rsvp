'use strict';

let	path = require('path'),
	q = require('q'),

	usersService = require(path.resolve('./services/users.profile.server.service.js'))(),
	User = require(path.resolve('./models/User'));

module.exports.create = function(req, res) {
	req.body.username = req.session.cas_username;
    req.body.email = `${req.session.cas_username}@terpmail.umd.edu`;

	if (req.body.class == null)
		req.body.class = 'Undefined';

	if (req.body.major == null)
		req.body.major = 'Undefined';

	if (req.body.roles == null) {
		req.body.roles = {
			type: {
				user: true,
				admin: false,
				superuser: false
			}
		};
	}

	usersService.createUser(req.body)
		.then(function(result) {
			res.render('profile.ejs', {user: result, username: req.session.cas_username});
		}, function(err) {
			res.status(400).json(err);
		});
};

module.exports.update = function(req, res) {
	usersService.searchUsers({username: req.session.cas_username})
		.then(function(oldUser) {
			return usersService.updateUser(oldUser.elements[0], {
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
			  });
		})
		.then(function(result) {
			// User has been updated
			console.log('POST updating new user: ' + result);
			req.flash("info", "Your profile has been updated.");
			res.redirect("profile");
		}, function(err) {
			// res.send("There was a problem updating the user: " + err);
			res.status(400).json(err);
		});
};

module.exports.adminify = function(req, res) {
	usersService.adminifyUser(req.params.username)
		.then(function(result) {
			// User has been adminified
			req.flash("info", "The user has been granted administrator privileges.");
			res.sendStatus(200);
		}, function(err) {
			// res.send("There was a problem updating the user: " + err);
			res.status(400).json(err);
		});
};

module.exports.unadminify = function(req, res) {
	usersService.unadminifyUser(req.params.username)
		.then(function(result) {
			// User has been adminified
			req.flash("info", "Administrator privileges have been revoked from this user.");
			res.sendStatus(200);
		}, function(err) {
			// res.send("There was a problem updating the user: " + err);
			res.status(400).json(err);
		});
};

module.exports.search = function(req, res) {
	usersService.searchUsers(req.query)
		.then(function(result) {
			res.status(200).json(result);
		}, function(err) {
			res.status(400).json(err);
		});
};
