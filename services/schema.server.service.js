'use strict';

let mongoose = require('mongoose'),
	Schema = mongoose.Schema;

exports.GetterSchema = function (add) {
	let schema = new Schema(add);

	schema.set('toObject', { getters: true });
	schema.set('toJSON', { getters: true });

	return schema;
};