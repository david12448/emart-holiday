const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch();
  fs.mkdirSync('test-results',{recursive:true});
  const base = process.env.PILOT_BASE || 'http://127.0.0.1:8765/emart-holiday';
  for (const viewport of [{width:1280,height:900},{width:390,height:844}]) {
    const page = await browser.newPage({viewport});
    await page.clock.install({time: new Date('2026-10-10T00:00:00Z')});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const route of ['emart/','emart/seoul/','emart/seoul/garden5/','emart/seoul/wangsimni/']) {
      const response = await page.goto(base + '/' + route + '?date=2026-10');
      assert.equal(response.status(),200, route);
      await page.locator('.month-calendar').waitFor();
      await page.reload();
      await page.locator('.month-calendar').waitFor();
      assert.match(await page.locator('.calendar-month-title').innerText(), /2026년 10월/);
      assert.ok(await page.locator('.calendar-day-clickable').count());
      const day = page.locator('.calendar-day-clickable').first();
      await day.click();
      assert.ok(await page.locator('.calendar-date-filter-clear').count());
      await page.locator('.calendar-date-filter-clear').click();
      assert.equal(await page.locator('.calendar-date-filter-clear').count(),0);
      assert.equal(await page.locator('.calendar-day-detail').count(),0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
    }
    await page.goto(base + '/emart/seoul/?date=2026-10');
    await page.locator('#content a[data-store-id="26744cf0b4147ae1"]').first().waitFor();
    await page.locator('#content a[data-store-id="26744cf0b4147ae1"]').first().click();
    await page.waitForURL('**/emart/seoul/garden5/**');
    await page.locator('.single-store-back-link').waitFor();
    assert.match(await page.title(),/가든5/);
    await page.screenshot({path:'test-results/garden5-' + viewport.width + '.png',fullPage:true});
    await page.waitForFunction(() => document.querySelector('link[rel="canonical"]').href.endsWith('/emart/seoul/garden5/'));
    const official = await page.evaluate(() => getStoreDetailUrl(holidayData.find(s => getStoreId(s) === '26744cf0b4147ae1')));
    assert.match(official,/mart-store-link-gateway.*\/r\/26744cf0b4147ae1/);
    await page.route(official, route => route.fulfill({status:200,body:'Protected official link requested'}));
    await page.locator('.store-detail-button').click();
    await page.waitForURL(official);
    await page.goBack();
    await page.locator('.single-store-back-link').waitFor();
    const back = await page.locator('.single-store-back-link').getAttribute('href');
    assert.match(back,/\/emart\/seoul\/\?date=2026-10/);
    await page.locator('.single-store-back-link').click();
    await page.locator('.month-calendar').waitFor();
    assert.ok(page.url().includes('region=%EC%84%9C%EC%9A%B8'));
    await page.goto(base + '/?region=%EC%84%9C%EC%9A%B8&storeId=26744cf0b4147ae1&date=2026-10');
    await page.locator('.single-store-back-link').waitFor();
    await page.waitForFunction(() => document.querySelector('link[rel="canonical"]').href.endsWith('/emart/seoul/garden5/'));
    assert.match(await page.locator('#content').innerText(),/가든5/);
    await page.goto(base + '/emart/seoul/garden5/calendar/');
    await page.locator('.month-calendar').waitFor();
    assert.equal(await page.locator('#page-title').isVisible(),false);
    await page.screenshot({path:'test-results/calendar-' + viewport.width + '.png',fullPage:true});
    assert.equal(await page.locator('#source-label').isVisible(),false);
    assert.equal(await page.locator('#embed-month-tabs button').count(),2);
    await page.locator('#embed-month-tabs button').last().click();
    assert.match(await page.locator('.calendar-month-title').innerText(),/2026년 11월/);
    assert.equal(await page.locator('#embed-unknown').isVisible(),false);
    assert.ok(await page.locator('.calendar-day-clickable').count());
    await page.locator('#embed-month-tabs button').first().click();
    assert.match(await page.locator('.calendar-month-title').innerText(),/2026년 10월/);
    // Separate unknown fixture: never erase the real archived November dates.
    await page.route('**/data/emart/holiday_archive.json*', async route => {
      const response = await route.fetch();
      const rows = await response.json();
      for (const row of rows) if (row.sid === '26744cf0b4147ae1') {
        row.holidays = row.holidays.filter(d => !d.startsWith('2026-11-'));
      }
      await route.fulfill({response,json:rows});
    });
    await page.reload();
    await page.locator('.month-calendar').waitFor();
    await page.locator('#embed-month-tabs button').last().click();
    assert.equal(await page.locator('#embed-unknown').isVisible(),true);
    assert.equal(await page.locator('.calendar-day-clickable').count(),0);
    assert.deepEqual(errors,[]);
    await page.close();
  }
  await browser.close();
  console.log('Desktop/mobile direct access, reload, legacy canonical, date filter, return and embed passed');
})().catch(e => {console.error(e); process.exit(1);});
