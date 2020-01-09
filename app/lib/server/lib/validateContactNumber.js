export const validateContactNumber = function(contact) {
	const contactValidation = /^(\+91[\-\s]?)?[0]?(91)?[789]\d{9}$/;
	if (!contactValidation.test(contact)) {
		throw new Meteor.Error('error-invalid-contact', `Invalid contact ${ contact }`, { function: 'RocketChat.validateContactNumber', contact });
	}
}