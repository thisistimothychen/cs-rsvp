'use strict';

let
	_ = require('lodash'),
	path = require('path'),
	q = require('q'),

	Event = require(path.resolve('./models/Event'));

module.exports = function() {

	/**
	 * Create a new event with the given info, returns a
	 * Promise fulfilled on event registration with the db.
	 *
	 * @param eventInfo
	 * @returns {Promise|*}
	 */
	function createEvent(eventInfo) {
		// Create the new tag model
		let newEvent = new Event(eventInfo);

		// Write the auto-generated metadata
		newEvent.created = Date.now();
		newEvent.updated = Date.now();
		newEvent.rsvpUsers = [];

		return newEvent.save();
	}

	function updateEvent(event, newEvent) {
		event.updated = Date.now();

		let mergedEvent = _.merge(event, newEvent);

		return mergedEvent.save();
	}
	
	function addUserRSVPToEvent(event, username) {
		event.updated = Date.now();
		
		// Insert user into event
		event.rsvpUsers.push(username);
		
		return event.save();
	}
	
	function removeUserRSVPToEvent(event, username) {
		event.updated = Date.now();
		
		// Remove user from event using Lodash
		var updatedArray = _.remove(event.rsvpUsers, function(user) {
			return user != username;
		});
		event.rsvpUsers = updatedArray;
		
		return event.save();
	}
	
	function deleteEvent(query) {
		return Event.remove(query).exec().then(function(result) {
			console.log("Remove result: " + result);
		});
	}

	function searchEvents(query) {
		return Event.find(query).sort({startTime: 1}).exec().then(function(result) {
			if (null == result) {
				return q({
					length: 0,
					elements: []
				});
			} else {
				return q({
					length: result.length,
					elements: result
				});
			}
		});
	}

	return {
		createEvent: createEvent,
		updateEvent: updateEvent,
		deleteEvent: deleteEvent,
		searchEvents: searchEvents,
		addUserRSVPToEvent: addUserRSVPToEvent,
		removeUserRSVPToEvent: removeUserRSVPToEvent
	};
};
