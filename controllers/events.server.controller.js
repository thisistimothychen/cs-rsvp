'use strict';

let path = require('path'),
	q = require('q'),

	eventsService = require(path.resolve('./services/events.server.service.js'))(),
	Event = require(path.resolve('./models/Event'));

module.exports.create = function(req, res) {
	eventsService.createEvent(req.body)
		.then(function(event) {
			req.flash('info', 'The event has been created.');
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

module.exports.delete = function(req, res) {
	console.log("ID: " + req.params.id);
	eventsService.deleteEvent({ _id: req.params.id })
		.then(function(result) {
			req.flash('info', 'The event has been deleted.');
			console.log("Event deleted (controller output).")
			
			res.sendStatus(200);
		}, function(err) {
			res.status(400).json(err);
		});
};


module.exports.userRSVP = function(req, res) {
	console.log("--Controller output--\n" + "User: " + req.session.cas_username + "\nID: " + req.params.id + "\n--END Controller output--");
	
	eventsService.searchEvents({ _id: req.params.id })
	.then(function(event) {
		return eventsService.addUserRSVPToEvent(event.elements[0], req.session.cas_username);
	})
	.then(function(updatedEvent) {
		// User has been added to event
		req.flash("info", "You have RSVP'd to " + updatedEvent.name + ".");
		res.redirect('/');
	}, function(err) {
		res.status(400).json(err);
	});
};



module.exports.userUnRSVP = function(req, res) {
	eventsService.searchEvents({ _id: req.params.id })
	.then(function(event) {
		return eventsService.removeUserRSVPToEvent(event.elements[0], req.session.cas_username);
	})
	.then(function(updatedEvent) {
		// User has been removed from the event
		console.log(updatedEvent.rsvpUsers);
		req.flash("info", "You have UnRSVP'd to " + updatedEvent.name + ".");
		res.redirect('/');
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
