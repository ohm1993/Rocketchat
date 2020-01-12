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
		query.roles = ['bot'];
		const users = Users.find(query, {
			sort: sort || { username: 1 },
			skip: offset,
			limit: count,
			fields,
		}).fetch();
		users.map(function(e){
			e.t = "d"
	   });

		return API.v1.success({
			users,
			count: users.length,
			offset,
			total: Users.find(query).count(),
		});
	},
});
