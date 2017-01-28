'use strict';

const bcrypt = require('bcrypt-nodejs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const path = require('path');

const schemaService = require(path.resolve('./services/schema.server.service'));
const GetterSchema = schemaService.GetterSchema;

const util = require(path.resolve('./services/util.server.service'));

/**
 * User Schema
 */

let UserSchema = new GetterSchema({
  firstName: {
  	type: String,
    trim: true,
    // required: 'First name is required'
  },
  lastName: {
  	type: String,
    trim: true,
    // required: 'Last name is required'
  },
	username: {
		type: String,
		trim: true,
        unique: 'This username is already taken',
		required: 'Username/UID is required'
	},
	email: {
		type: String,
		trim: true,
		required: 'Email is required',
		match: [/.+\@.+\..+/, 'A valid email address is required']
	},
	roles: {
		type: {
			user: {
				type: Boolean,
				default: true
			},
			admin: {
				type: Boolean,
				default: false
			},
			superuser: {
				type: Boolean,
				default: false
			}
		}
	},
	resume: {
    	type: String
	},
	major: {
    	type: String,
		// required: 'Major is required',
		trim: true
	},
	// class standing (e.g. Freshman, Sophomore, etc.)
	class: {
  	type: String,
		// required: 'Class standing is required',
		trim: true
	},
	updated: {
		type: Date,
		get: util.dateParse
	},
	created: {
		type: Date,
		default: Date.now,
		get: util.dateParse
	},
	lastLogin: {
		type: Date,
		default: null,
		get: util.dateParse
	}
});

/**
 * Index declarations
 */

// Text-search index
UserSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  username: 'text',
  'roles.type.user': 'boolean',
  'roles.type.admin': 'boolean',
  'roles.type.superuser': 'boolean',
  major: 'text',
  class: 'text'
});


/**
 * Password hash middleware.
 */
UserSchema.pre('save', function save(next) {
  const user = this;
  if (!user.isModified('password')) { return next(); }
  bcrypt.genSalt(10, (err, salt) => {
    if (err) { return next(err); }
    bcrypt.hash(user.password, salt, null, (err, hash) => {
      if (err) { return next(err); }
      user.password = hash;
      next();
    });
  });
});

/**
 * Helper method for validating user's password.
 */
UserSchema.methods.comparePassword = function comparePassword(candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
    cb(err, isMatch);
  });
};

/**
 * Helper method for getting user's gravatar.
 */
UserSchema.methods.gravatar = function gravatar(size) {
  if (!size) {
    size = 200;
  }
  if (!this.email) {
    return `https://gravatar.com/avatar/?s=${size}&d=retro`;
  }
  const md5 = crypto.createHash('md5').update(this.email).digest('hex');
  return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
};

const User = mongoose.model('User', UserSchema);
module.exports = User;