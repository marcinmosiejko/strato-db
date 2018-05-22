import DB from '../DB'
import ESDB from '../EventSourcingDB'
import EQ from '../EventQueue'
import JsonModel from '../JsonModel'

export {DB, JsonModel}

export const getModel = options => {
	const db = new DB()
	return db.addModel(JsonModel, {name: 'testing', ...options})
}

export const sharedSetup = getPromise => fn => {
	let promise
	return async () => {
		if (!promise) {
			promise = getPromise()
		}
		return fn(await promise)
	}
}

export const testModels = {
	count: {
		// shortName: 'c',
		columns: {
			total: {type: 'INTEGER', value: o => o.total, get: true},
		},
		// Needs JsonModel to create intermediate jM to set values
		// migrations: {
		// 	0: {up(db, jM) => jM.set({id: 'count', total: 0, byType: {}})},
		// },
		reducer: async (model, {type}) => {
			if (!model) {
				return {}
			}
			if (type === 'errorme') throw new Error('error for you')
			const c = (await model.get('count')) || {
				id: 'count',
				total: 0,
				byType: {},
			}
			c.total++
			c.byType[type] = (c.byType[type] || 0) + 1
			return {
				set: [c],
				// audit: '',
			}
		},
	},
	ignorer: {
		reducer: (model = null) => model,
	},
	deriver: {
		deriver: async ({model, store, result, event}) => {
			if (result !== event.result) {
				throw new Error('Expecting event.result as separate input')
			}
			if (event.result.count) {
				const currentCount = await store.count.get('count')
				await model.set({
					id: 'descCount',
					desc: `Total: ${currentCount.total}, seen types: ${Object.keys(
						currentCount.byType
					)}`,
				})
			}
		},
	},
}
const withDBs = fn => {
	const db = new DB({name: 'D'})
	const queue = new EQ({db: new DB({name: 'Q'})})
	try {
		return fn(db, queue)
	} finally {
		db.close()
	}
}
export const withESDB = (fn, models = testModels) =>
	withDBs((db, queue) => {
		const eSDB = new ESDB({queue, models, name: 'E'})
		try {
			return fn(eSDB, queue)
		} finally {
			eSDB.close()
		}
	})
