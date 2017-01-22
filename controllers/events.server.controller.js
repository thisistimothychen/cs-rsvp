'use strict';

let path = require('path'),
	q = require('q'),

	eventsService = require(path.resolve('./services/events.server.service.js'))(),
	Event = require(path.resolve('./models/Event'));

module.exports.create = function(req, res) {
	eventsService.createEvent(req.body)
		.then(function(event) {
			res.redirect(`/event/${event._id}/edit`);
		}, function(err) {
			res.status(400).json(err);
		});
};

module.exports.update = function(req, res) {
	eventsService.searchEvents({ _id: req.params.id })
	.then(function(oldEvent) {
		return eventsService.updateEvent(oldEvent.elements[0], req.body);
	})
	.then(function(updatedEvent) {
		// Event has been updated
		console.log('POST updating event to: ' + updatedEvent);
		req.flash("info", "Event has been updated.");

		res.redirect(`/event/${req.params.id}/edit`);
	}, function(err) {
		res.status(400).json(err);
	});
};

module.exports.search = function(req, res) {
	eventsService.searchEvents(req.query)
		.then(function(result) {
			res.status(200).json(result);
		}, function(err) {
			res.status(400).json(err);
		});
};
