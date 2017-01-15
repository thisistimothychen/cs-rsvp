'use strict';

let	path = require('path'),
	q = require('q'),

	usersService = require(path.resolve('./services/users.profile.server.service.js'))(),
	User = require(path.resolve('./models/User'));

module.exports.create = function(req, res) {
	req.body.username = req.session.cas_username;

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
			// console.log(result);
			// res.status(200).json(result);
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
		           res.json(result);
	           }
			});
		}, function(err) {
			res.status(400).json(err);
		});
};

module.exports.update = function(req, res) {
	usersService.updateUser(req.body.oldUser, req.body.newUser)
		.then(function(result) {
			res.status(200).json(result);
		}, function(err) {
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