import { sleep, check, fail } from 'k6'
import http from 'k6/http'
import jsonpath from 'https://jslib.k6.io/jsonpath/1.0.2/index.js'

export const options = {
    cloud: {
        distribution: { 'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 100 } },
        apm: [],
    },
    thresholds: {},
    scenarios: {
        Scenario_1: {
            executor: 'ramping-vus',
            gracefulStop: '30s',
            stages: [
                { target: 5, duration: '30s' },
                { target: 15, duration: '1m' },
                { target: 10, duration: '30s' },
                { target: 0, duration: '30s' },
            ],
            gracefulRampDown: '30s',
            exec: 'scenario_1',
        },
    },
}

export function scenario_1() {
    let response

    const vars = {}

    // Login
    response = http.put(
        'https://pizza-service.pizza-spencer.click/api/auth',
        '{"email": "d@jwt.com", "password": "diner"}',
        {
            headers: {
                accept: '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                'content-type': 'application/json',
                origin: 'https://pizza.pizza-spencer.click',
                priority: 'u=1, i',
                'sec-ch-ua': '"Chromium";v="142", "Microsoft Edge";v="142", "Not_A Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                Authorization: '$.token',
            },
        }
    )
    if(!check(response, { 'status equals 200': response => response.status.toString() === '200' })) {
        console.error(`Login failed: ${response.status} ${response.body}`)
        fail();
    }
    vars['token'] = jsonpath.query(response.json(), '$.token')[0]

    sleep(1)
    // Click Order
    response = http.get('https://pizza-service.pizza-spencer.click/api/order/menu', {
        headers: {
            accept: '*/*',
            'accept-encoding': 'gzip, deflate, br, zstd',
            'accept-language': 'en-US,en;q=0.9',
            authorization: `Bearer ${vars['token']}`,
            'content-type': 'application/json',
            origin: 'https://pizza.pizza-spencer.click',
            priority: 'u=1, i',
            'sec-ch-ua': '"Chromium";v="142", "Microsoft Edge";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
        },
    })
    if(!check(response, { 'status equals 200': response => response.status.toString() === '200' })) {
        console.error(`Getting menu failed: ${response.status} ${response.body}`)
        fail();
    }

    // Franchises Load
    response = http.get(
        'https://pizza-service.pizza-spencer.click/api/franchise?page=0&limit=20&name=*',
        {
            headers: {
                accept: '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                authorization: `Bearer ${vars['token']}`,
                'content-type': 'application/json',
                origin: 'https://pizza.pizza-spencer.click',
                priority: 'u=1, i',
                'sec-ch-ua': '"Chromium";v="142", "Microsoft Edge";v="142", "Not_A Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
            },
        }
    )
    if(!check(response, { 'status equals 200': response => response.status.toString() === '200' })) {
        console.error(`Getting franchises failed: ${response.status} ${response.body}`)
        fail();
    }
    sleep(1.5)

    // Click Buy
    response = http.get('https://pizza-service.pizza-spencer.click/api/user/me', {
        headers: {
            accept: '*/*',
            'accept-encoding': 'gzip, deflate, br, zstd',
            'accept-language': 'en-US,en;q=0.9',
            authorization: `Bearer ${vars['token']}`,
            'content-type': 'application/json',
            'if-none-match': 'W/"73-21nuLHAwVr35ICaKYH7KJ2AVbXY"',
            origin: 'https://pizza.pizza-spencer.click',
            priority: 'u=1, i',
            'sec-ch-ua': '"Chromium";v="142", "Microsoft Edge";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
        },
    })

    if(!check(response, { 'status equals 200': response => response.status.toString() === '200' })) {
        console.error(`Getting user failed: ${response.status} ${response.body}`)
        fail();
    }
    sleep(1.5)

    // Click Purchase
    response = http.post(
        'https://pizza-service.pizza-spencer.click/api/order',
        '{"items":[{"menuId":1,"description":"Veggie","price":0.0038},{"menuId":1,"description":"Veggie","price":0.0038},{"menuId":1,"description":"Veggie","price":0.0038}],"storeId":"1","franchiseId":1}',
        {
            headers: {
                accept: '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                authorization: `Bearer ${vars['token']}`,
                'content-type': 'application/json',
                origin: 'https://pizza.pizza-spencer.click',
                priority: 'u=1, i',
                'sec-ch-ua': '"Chromium";v="142", "Microsoft Edge";v="142", "Not_A Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
            },
        }
    )
    if(!check(response, { 'status equals 200': response => response.status.toString() === '200' })) {
        console.error(`Purchase failed: ${response.status} ${response.body}`)
        fail();
    }
    vars['pizza-jwt'] = jsonpath.query(response.json(), '$.jwt')[0]

    // Verify
    response = http.post(
        'https://pizza-factory.cs329.click/api/order/verify',
        `{"jwt":"${vars['pizza-jwt']}"}`,
        {
            headers: {
                accept: '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                authorization: `Bearer ${vars['token']}`,
                'content-type': 'application/json',
                origin: 'https://pizza.pizza-spencer.click',
                priority: 'u=1, i',
                'sec-ch-ua': '"Chromium";v="142", "Microsoft Edge";v="142", "Not_A Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
            },
        }
    )
    if(!check(response, { 'status equals 200': response => response.status.toString() === '200' })) {
        console.error(`Verifying order failed: ${response.status} ${response.body}`)
        fail();
    }
}