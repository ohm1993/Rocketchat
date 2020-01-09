import { Meteor } from 'meteor/meteor';
import { Match, check } from 'meteor/check';
import { Accounts } from 'meteor/accounts-base';
import s from 'underscore.string';
import speakeasy from 'speakeasy';

import * as Mailer from '../../app/mailer';
import { Users } from '../../app/models';
import { settings } from '../../app/settings';
import { saveCustomFields, validateEmailDomain, passwordPolicy, validateContactNumber } from '../../app/lib';

let verifyEmailTemplate = '';
let window = 2;
function sendSMS(toNumber, message, otp) {
	console.log('the otp in sendSMS is', otp);
	const apiKey = 'A932b8f7a2dac6ee5a679fa6b53ea8bae';
	let template = message || `%3C%23%3E \d\d\d\d is the OTP to log in to Chaturai App.  This is valid for ${window} minutes.
eFamcaJwveo`;
	template = template.replace('\d\d\d\d', otp);
	template = template.replace(/\s/g, '+');
	let url2 = `https://api-alerts.solutionsinfini.com/v4/?method=sms&api_key=${apiKey}&to=${toNumber}&sender=CHATUR&message=${template}&format=json`;
	var res = HTTP.call('POST', url2);
	console.log("res is",res);
    return res;
}

function generateToken(secret) {
	console.log('the secret used', secret);
	return token = speakeasy.totp({
	  secret,
	  encoding: 'base32'
	});
}
Meteor.startup(() => {
	Mailer.getTemplateWrapped('Verification_Email', (value) => {
		verifyEmailTemplate = value;
	});
});
Meteor.methods({
	registerUser(formData) {
		const AllowAnonymousRead = settings.get('Accounts_AllowAnonymousRead');
		const AllowAnonymousWrite = settings.get('Accounts_AllowAnonymousWrite');
		const manuallyApproveNewUsers = settings.get('Accounts_ManuallyApproveNewUsers');
		if (AllowAnonymousRead === true && AllowAnonymousWrite === true && formData.email == null) {
			const userId = Accounts.insertUserDoc({}, {
				globalRoles: [
					'anonymous',
				],
			});

			// const stampedLoginToken = Accounts._generateStampedLoginToken();

			// Accounts._insertLoginToken(userId, stampedLoginToken);
			// return stampedLoginToken;
			const { id, token } = Accounts._loginUser(this, userId);

			return { id, token };
		}else{
			check(formData, Match.ObjectIncluding({
				email: Match.Optional(String),
				pass: Match.Optional(String),
				name: Match.Optional(String),
				secretURL: Match.Optional(String),
				reason: Match.Optional(String),
				contact: Match.Optional(String)
			}));
		}
		// check(formData, Match.ObjectIncluding({
		// 	email: String,
		// 	pass: String,
		// 	name: String,
		// 	secretURL: Match.Optional(String),
		// 	reason: Match.Optional(String),
		// }));


		if (settings.get('Accounts_RegistrationForm') === 'Disabled') {
			throw new Meteor.Error('error-user-registration-disabled', 'User registration is disabled', { method: 'registerUser' });
		} else if (settings.get('Accounts_RegistrationForm') === 'Secret URL' && (!formData.secretURL || formData.secretURL !== settings.get('Accounts_RegistrationForm_SecretURL'))) {
			throw new Meteor.Error('error-user-registration-secret', 'User registration is only allowed via Secret URL', { method: 'registerUser' });
		}

		// passwordPolicy.validate(formData.pass);

		// validateEmailDomain(formData.email);

		// const userData = {
		// 	email: s.trim(formData.email.toLowerCase()),
		// 	password: formData.pass,
		// 	name: formData.name,
		// 	reason: formData.reason,
		// };
		let secret,	importedUser, invitedUser;
		const userData = {
			password: formData.pass,
			name: formData.name,
			reason: formData.reason,
			phones: [{
				number: formData.contact,
				verified: false
			}]
		};

		if (formData.email) { // if email is present then only
			passwordPolicy.validate(formData.pass);
		} else {
			let randomPass = Math.random()*1000000;
			userData.password = formData.pass = `${randomPass}PASS`;
		}

		if (formData.contact) { // give priority to contact
			validateContactNumber(formData.contact);
			// for invited users when creating a group. We should check whether they are invited and update the user details. TODO
			invitedUser = Users.findOneByContactNumberandNotVerified(formData.contact);
		} else if (formData.email) {
			validateEmailDomain(formData.email);
			userData.email = s.trim(formData.email.toLowerCase());
			// Check if user has already been imported and never logged in. If so, set password and let it through
			importedUser = RocketChat.models.Users.findOneByEmailAddress(s.trim(formData.email.toLowerCase()));
		}

		let userId;
		if (importedUser && importedUser.importIds && importedUser.importIds.length && !importedUser.lastLogin) {
			Accounts.setPassword(importedUser._id, userData.password);
			userId = importedUser._id;
		} else if (invitedUser) { // the user is already invited by a group admin
			userId = invitedUser._id;
			secret = invitedUser.services.sms;
			// Accounts.setPassword(invitedUser._id, userData.password);
		} else if (formData.contact && !invitedUser) {
			userData.username = formData.contact;
			secret = speakeasy.generateSecret().base32; // only for new users
			userId = Accounts.createUser(userData);
			Users.setContact(userId, formData.contact, secret);
			//RocketChat.models.Users.setContact(userId, formData.contact, secret);
			Accounts.setPassword(userId, userData.password);
		} else {
			userId = Accounts.createUser(userData);
		}

		Users.setName(userId, s.trim(formData.name));

		const reason = s.trim(formData.reason);
		if (manuallyApproveNewUsers && reason) {
			Users.setReason(userId, reason);
		}
		 
		saveCustomFields(userId, formData);

		try {
			if (settings.get('Verification_Customized')) {
				const subject = Mailer.replace(settings.get('Verification_Email_Subject') || '');
				const html = Mailer.replace(settings.get('Verification_Email') || '');
				Accounts.emailTemplates.verifyEmail.subject = () => subject;
				Accounts.emailTemplates.verifyEmail.html = (userModel, url) => html.replace(/\[Verification_Url]/g, url);
			}
			// the phone number validation should be done during registraion
			if (formData.contact) {
				const token = generateToken(secret);
				sendSMS(formData.contact, null, token);
			} else if (formData.email) {
				Accounts.sendVerificationEmail(userId, userData.email);
			}
		} catch (error) {
			// throw new Meteor.Error 'error-email-send-failed', 'Error trying to send email: ' + error.message, { method: 'registerUser', message: error.message }
		}
		return userId;
		// // Check if user has already been imported and never logged in. If so, set password and let it through
		// const importedUser = Users.findOneByEmailAddress(s.trim(formData.email.toLowerCase()));
		// let userId;
		// if (importedUser && importedUser.importIds && importedUser.importIds.length && !importedUser.lastLogin) {
		// 	Accounts.setPassword(importedUser._id, userData.password);
		// 	userId = importedUser._id;
		// } else {
		// 	userId = Accounts.createUser(userData);
		// }

		// Users.setName(userId, s.trim(formData.name));

		// const reason = s.trim(formData.reason);
		// if (manuallyApproveNewUsers && reason) {
		// 	Users.setReason(userId, reason);
		// }

		// saveCustomFields(userId, formData);

		// try {
		// 	const subject = Mailer.replace(settings.get('Verification_Email_Subject'));

		// 	Accounts.emailTemplates.verifyEmail.subject = () => subject;
		// 	Accounts.emailTemplates.verifyEmail.html = (userModel, url) => Mailer.replace(Mailer.replacekey(verifyEmailTemplate, 'Verification_Url', url), userModel);

		// 	Accounts.sendVerificationEmail(userId, userData.email);
		// } catch (error) {
		// 	// throw new Meteor.Error 'error-email-send-failed', 'Error trying to send email: ' + error.message, { method: 'registerUser', message: error.message }
		// }

		// return userId;
	},
});
