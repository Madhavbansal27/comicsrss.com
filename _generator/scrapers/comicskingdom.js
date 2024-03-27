const fetch2 = require('./lib/fetch.js')
const { query_html, element_to_text } = require('./lib/query-html.js')

module.exports = async function main(cachedSeriesObjects) {
	const base = 'https://comicskingdom.com/features'
	const html = await fetch2(base)
	const $ = query_html(html)

	const seriesObjectEntries = $('main ul > li > ul > li > a')
		.map((a_element) => {
			const parsed = new URL(a_element.attribs.href, base)
			const slug = parsed.pathname.replace(/^\//, '')
			const title = element_to_text(a_element)

			return [ slug, {
				// author: null,
				// isPolitical: null,
				title,
				url: parsed.href,
				language: title.endsWith('(Spanish)') ? 'spa' : 'eng',
			}]
		})
		.slice(0, global.DEBUG ? 10 : Infinity)
	if (global.VERBOSE) {
		console.log(`comicskingdom: found ${ seriesObjectEntries.length } entries`)
	}

	for (const [ slug, seriesObject ] of seriesObjectEntries) {
		new Promise(resolve => setTimeout(resolve, global.DEBUG ? 0 : 1000)) // rate limit

		if (global.VERBOSE) {
			console.log('comicskingdom: ' + slug)
		}
		const json = await fetch2(`https://wp.comicskingdom.com/wp-json/wp/v2/ck_comic?ck_feature=${ slug }&before_ymd=${ new Date().toISOString().slice(0, 10) }&per_page=40&date_inclusive=true&order=desc&page=1&_embed=true`)
		const arr = JSON.parse(json)
		if (!(Array.isArray(arr) && arr.length)) {
			throw new Error(`didn't get an array`)
		}

		seriesObject.isPolitical = arr[0].ck_genre?.name === 'Political'

		const strips = arr.map(e => ({
			imageUrl: e.assets.single.url,
			date: e.date.slice(0, 10),
			url: e.link,
		}))

		const oldestStripDate = cachedSeriesObjects[slug]?.strips?.[0]?.date || '0000-00-00'

		seriesObject.strips = [
			...strips.filter(s => s.date > oldestStripDate),
			...(cachedSeriesObjects[slug]?.strips || []),
		]
	}

	return Object.fromEntries(seriesObjectEntries)
}
