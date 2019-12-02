import { API } from '../api';

API.v1.addRoute('getapplication', { authRequired: true }, {
	get() {
		const applications = [{
			id: 1,
			name: 'CALENDAR',
			msg: 'calender',
		},
		{
			id: 2,
			name: 'UTILITIES',
			msg: 'utilities',
		},
		{
			id: 3,
			name: 'PERSONAL',
			msg: 'personal',
		}];
		return API.v1.success({ applications });
	},
});
