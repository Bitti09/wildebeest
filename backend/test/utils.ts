import { strict as assert } from 'node:assert/strict'
import type { Cache } from 'wildebeest/backend/src/cache'
import type { Queue } from 'wildebeest/backend/src/types/queue'
import { createClient } from 'wildebeest/backend/src/mastodon/client'
import type { Client } from 'wildebeest/backend/src/mastodon/client'
import { promises as fs } from 'fs'
import * as path from 'path'
import { BetaDatabase } from '@miniflare/d1'
import * as Database from 'better-sqlite3'

export function isUrlValid(s: string) {
	let url
	try {
		url = new URL(s)
	} catch (err) {
		return false
	}
	return url.protocol === 'https:'
}

export async function makeDB(): Promise<D1Database> {
	const db = new Database(':memory:')
	const db2 = new BetaDatabase(db)!

	// Manually run our migrations since @miniflare/d1 doesn't support it (yet).
	const migrations = await fs.readdir('./migrations/')

	for (let i = 0, len = migrations.length; i < len; i++) {
		const content = await fs.readFile(path.join('migrations', migrations[i]), 'utf-8')
		db.exec(content)
	}

	return db2 as unknown as D1Database
}

export function assertCORS(response: Response) {
	assert(response.headers.has('Access-Control-Allow-Origin'))
	assert(response.headers.has('Access-Control-Allow-Headers'))
}

export function assertJSON(response: Response) {
	assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8')
}

export function assertCache(response: Response, maxge: number) {
	assert(response.headers.has('cache-control'))
	assert(response.headers.get('cache-control')!.includes('max-age=' + maxge))
}

export async function streamToArrayBuffer(stream: ReadableStream) {
	let result = new Uint8Array(0)
	const reader = stream.getReader()
	while (true) {
		const { done, value } = await reader.read()
		if (done) {
			break
		}

		const newResult = new Uint8Array(result.length + value.length)
		newResult.set(result)
		newResult.set(value, result.length)
		result = newResult
	}
	return result
}

export async function createTestClient(
	db: D1Database,
	redirectUri: string = 'https://localhost',
	scopes: string = 'read follow'
): Promise<Client> {
	return createClient(db, 'test client', redirectUri, 'https://cloudflare.com', scopes)
}

type TestQueue = Queue<any> & { messages: Array<any> }

export function makeQueue(): TestQueue {
	const messages: Array<any> = []

	return {
		messages,

		async send(msg: any) {
			messages.push(msg)
		},

		async sendBatch(batch: Array<{ body: any }>) {
			for (let i = 0, len = batch.length; i < len; i++) {
				messages.push(batch[i].body)
			}
		},
	}
}

export function makeCache(): Cache {
	const cache: any = {}

	return {
		async get<T>(key: string): Promise<T | null> {
			if (cache[key]) {
				return cache[key] as T
			} else {
				return null
			}
		},

		async put<T>(key: string, value: T): Promise<void> {
			cache[key] = value
		},
	}
}

export function isUUID(v: string): boolean {
	assert.equal(typeof v, 'string')
	if (v.match('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') === null) {
		return false
	}
	return true
}
