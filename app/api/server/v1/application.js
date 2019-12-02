import { API } from '../api';

API.v1.addRoute('getapplication', { authRequired: true }, {
	get() {
		const applications = {b:1};
		return API.v1.success({ applications });
	},
});