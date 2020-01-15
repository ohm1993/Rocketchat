import { API } from '../api';
import { Users } from '../../../models/server';
import { hasPermission } from '../../../authorization';

API.v1.addRoute('getapplication', { authRequired: true }, {
	get() {
		if (!hasPermission(this.userId, 'view-d-room')) {
			return API.v1.unauthorized();
		}

		const { offset, count } = this.getPaginationItems();
		const { sort, fields, query } = this.parseJsonQuery();

		let result;
		let botUsers = [];
		Meteor.runAsUser(this.userId, () => { result = Meteor.call('rooms/get', {}); });
		result.map(function(username){
			if(username.t == 'd'){
				if(username.usernames && username.usernames.length){
					username.usernames.map(function(user){
						botUsers.push(user);
					})
				}
			}	
		})
		query.roles = ['bot'];
		query.username = { $nin: botUsers};
		const users = Users.find(query, {
			sort: sort || { username: 1 },
			skip: offset,
			limit: count,
			fields,
		}).fetch();
		users.map(function(e){
			e.t = "d",
			e.fname = e.name
	   });

		return API.v1.success({
			users,
			count: users.length,
			offset,
			total: Users.find(query).count(),
		});
	},
});
