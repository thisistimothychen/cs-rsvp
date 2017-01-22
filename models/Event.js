'use strict';

const mongoose = require('mongoose');
const path = require('path');

const schemaService = require(path.resolve('./services/schema.server.service'));
const GetterSchema = schemaService.GetterSchema;

const util = require(path.resolve('./services/util.server.service'));

/**
 * Event Schema
 */

let EventSchema = new GetterSchema({
	name: {
		type: String,
		trim: true,
		required: 'Event name is required'
	},
	description: {
		type: String,
		trim: true
	},
	location: {
		type: String,
		required: 'Event location is required',
		trim: true
	},
	photo: {
		type: String
	},
	sponsors: [{
		type: String,
		trim: true
	}],
	rsvpUsers: [{
		type: mongoose.Schema.ObjectId,
		ref: 'User'
	}],
	rsvpLimit: {
		type: Number
	},
	// major restrictions
	major: [{
		type: String,
		trim: true
	}],
	lockoutTime: {
		type: Number
	},
	// minimum class standing (e.g. Freshman, Sophomore, etc.)
	class: {
		type: String,
		trim: true
	},
	startTime: {
		type: Date,
		get: util.dateParse,
		required: 'Event start time is required'
	},
	endTime: {
		type: Date,
		get: util.dateParse
	},
	created: {
		type: Date,
		default: Date.now,
		get: util.dateParse
	},
	createdBy: {
		type: String,
		trim: true,
	},
	tags: [{
		type: String,
		trim: true
	}]
});

/**
 * Index declarations
 */

// Text-search index
EventSchema.index({ name: 'text'});

const Event = mongoose.model('Event', EventSchema);
module.exports = Event;
