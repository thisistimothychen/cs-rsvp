'use strict';

module.exports.dateParse = function (date) {
	if (null == date)
		return null;

	return Date.parse(date);
};