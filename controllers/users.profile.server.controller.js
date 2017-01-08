'use strict';

let _ = require('lodash'),
	path = require('path'),
	q = require('q'),

	usersService = require(path.resolve('../services/users.profile.server.service.js'))();
	User = require(path.resolve('../models/User'));

module.exports.create = function(req, res) {
	usersService.createUser(req.body)
		.then(function(result) {
			res.status(200).json(result);
		}, function(err) {
			res.status(400).json(err);
		}).done();
};

module.exports.update = function(req, res) {
	usersService.updateUser(req.body.oldUser, req.body.newUser)
		.then(function(result) {
			res.status(200).json(result);
		}, function(err) {
			res.status(400).json(err);
		}).done();
};

module.exports.search = function(req, res) {
	usersService.searchUsers(req.query)
		.then(function(result) {
			res.status(200).json(result);
		}, function(err) {
			res.status(400).json(err);
		}).done();
};