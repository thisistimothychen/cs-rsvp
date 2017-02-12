'use strict';

let
	_ = require('lodash'),
	path = require('path'),
	q = require('q'),
	fs = require('fs-extra'),
	archiver = require('archiver'),

	User = require(path.resolve('./models/User')),
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
		if (newEvent.tags) {
			mergedEvent.markModified('tags');
			mergedEvent.tags = newEvent.tags;
		}
		if (newEvent.sponsors) {
			mergedEvent.markModified('sponsors');
			mergedEvent.sponsors = newEvent.sponsors;
		}
		if (newEvent.major) {
			mergedEvent.markModified('major');
			mergedEvent.major = newEvent.major;
		}
		if (newEvent.resumes) {
			mergedEvent.markModified('resumes');
			mergedEvent.resumes = newEvent.resumes;
		}

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

	function getResumeBook(id, res) {
		return Event.findOne({_id: id}, { resumes: 1 }).exec()
			.then((result) => {
				if (result == null) {
					res.status(500).json('Event id is invalid!');
					return;
				}

				let baseDirectory = `${path.join(__dirname, '..', 'uploads', id)}-resume-book/`;

				fs.removeSync(baseDirectory);
				fs.ensureDirSync(baseDirectory);

				let outputFileName = `${path.join(__dirname, '..', 'uploads')}/${id}.zip`;
				let output = fs.createWriteStream(outputFileName);

				let archive = archiver('zip', { store: true });

				output.on('open', () => {
					archive.pipe(output);

					let promises = [];

					for (let i = 0; i < result.resumes.length; i++) {
						let resume = result.resumes[i];

						if (resume.option === 'Profile') {
							promises.push(
								User.findOne({username: resume.user}).exec()
									.then((user) => {
										if (user != null && user.resume != null && user.resume.type != null) {
											fs.copySync(user.resume.type.filepath, `${baseDirectory}/${resume.user}`);
										}
									}, (err) => {
										console.log(err);
									})
							);
						}
						else if (resume.option === 'Custom') {
							fs.copySync(resume.eventResume.type.filepath, `${baseDirectory}/${resume.user}`);
						}
					}

					q.allSettled(promises)
						.then(() => {
							archive.directory(`uploads/${id}-resume-book/`, `${id}-resume-book`);
							archive.finalize();
						}, (err) => {
							console.log(err);
						});
				});

				output.on('close', function() {
					res.download(outputFileName, outputFileName);
				});

				output.on('error', function(err) {
					res.status(500).json(err);
				});
			});
	}

	return {
		createEvent: createEvent,
		updateEvent: updateEvent,
		deleteEvent: deleteEvent,
		searchEvents: searchEvents,
		addUserRSVPToEvent: addUserRSVPToEvent,
		removeUserRSVPToEvent: removeUserRSVPToEvent,
		getResumeBook: getResumeBook
	};
};
