'use strict';

let
	_ = require('lodash'),
	path = require('path'),
	q = require('q'),

	User = require(path.resolve('../models/User'));

module.exports = function() {

	/**
	 * Create a new user account with the given user info, returns a
	 * Promise fulfilled on account registration with the db.
	 *
	 * @param userInfo
	 * @returns {Promise|*}
	 */
	function createUser(userInfo) {
		// Create the new tag model
		let newUser = new User(userInfo);

		// Write the auto-generated metadata
		newUser.created = Date.now();
		newUser.updated = Date.now();

		return newUser.save();
	}

	function updateUser(user, newUser) {
		user.updated = Date.now();

		let mergedUser = _.merge(user, newUser);

		return mergedUser.save();
	}

	function searchUsers(query) {
		return User.find(query).exec().then(function(result) {
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
		createUser: createUser,
		updateUser: updateUser,
		searchUsers: searchUsers
	};
};