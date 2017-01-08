'use strict';

let path = require('path'),
	q = require('q'),

	eventsService = require(path.resolve('../services/events.server.service.js'))();
	Event = require(path.resolve('../models/Event'));

module.exports.create = function(req, res) {
	eventsService.createEvent(req.body)
		.then(function(result) {
			res.status(200).json(result);
		}, function(err) {
			res.status(400).json(err);
		}).done();
};

module.exports.update = function(req, res) {
	eventsService.updateEvent(req.body.oldEvent, req.body.newEvent)
		.then(function(result) {
			res.status(200).json(result);
		}, function(err) {
			res.status(400).json(err);
		}).done();
};

module.exports.search = function(req, res) {
	eventsService.searchEvents(req.query)
		.then(function(result) {
			res.status(200).json(result);
		}, function(err) {
			res.status(400).json(err);
		}).done();
};