let socket;
let balance = 0;
let holdings = {}; // Store user's crypto holdings

// Fetch and update balance
async function fetchBalance() {
    const response = await fetch('/api/balance');
    const data = await response.json();
    balance = data;
    updateBalance(balance);
}

// Update balance display
function updateBalance(newBalance) {
    const balanceElement = document.getElementById('balance');
    balanceElement.textContent = `Balance: $${newBalance.toFixed(2)}`;
}

// Fetch user's holdings
async function fetchHoldings() {
    const response = await fetch('/api/balance/holdings');
    holdings = await response.json();
}

// Reset balance
async function resetBalance() {
    await fetch('/api/balance/reset', { method: 'POST' });
    await fetchBalance();
    await fetchHoldings(); // Refresh holdings after reset
    console.log('Balance reset');
}

// Fetch and display transaction history
async function fetchTransactionHistory() {
    const response = await fetch('/api/balance/history');
    const history = await response.json();
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = history.map(transaction => `<li>${transaction}</li>`).join('');
}

// Buy crypto
async function buyCrypto(symbol, amount, price) {
    const response = await fetch(`/api/balance/buy?symbol=${symbol}&amount=${amount}&price=${price}`, {
        method: 'POST',
    });
    const result = await response.text();
    console.log(result);
    await fetchBalance();
    await fetchHoldings(); // Refresh holdings after buying
    await fetchTransactionHistory();
}

// Sell crypto
async function sellCrypto(symbol, amount, price) {
    const response = await fetch(`/api/balance/sell?symbol=${symbol}&amount=${amount}&price=${price}`, {
        method: 'POST',
    });
    const result = await response.text();
    console.log(result);
    await fetchBalance();
    await fetchHoldings(); // Refresh holdings after selling
    await fetchTransactionHistory();
}

// Add event listeners to Buy/Sell buttons
function addButtonListeners() {
    document.querySelectorAll('.buy').forEach(button => {
        button.addEventListener('click', () => {
            const symbol = button.getAttribute('data-symbol');
            const price = parseFloat(button.getAttribute('data-price'));
            const amount = parseFloat(prompt(`Enter amount of ${symbol} to buy:`));
            if (!isNaN(amount) && amount > 0) {
                buyCrypto(symbol, amount, price);
            } else {
                alert('Invalid amount');
            }
        });
    });

    document.querySelectorAll('.sell').forEach(button => {
        button.addEventListener('click', () => {
            const symbol = button.getAttribute('data-symbol');
            const price = parseFloat(button.getAttribute('data-price'));
            const amount = parseFloat(prompt(`Enter amount of ${symbol} to sell:`));
            if (!isNaN(amount) && amount > 0) {
                sellCrypto(symbol, amount, price);
            } else {
                alert('Invalid amount');
            }
        });
    });
}

// WebSocket connection for live crypto prices
function connectWebSocket() {
    socket = new WebSocket('ws://localhost:8080/api/crypto/live');

    socket.onopen = function () {
        console.log('Connected to WebSocket server');
    };

    socket.onmessage = async function (event) {
        try {
            const cryptos = JSON.parse(event.data);
            const cryptoTable = document.getElementById('crypto-table');
            cryptoTable.innerHTML = '';

            // Add a header row
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `
                <th>Name</th>
                <th>Symbol</th>
                <th>Price (USD)</th>
                <th>Actions</th>
                <th>You Own</th>
            `;
            cryptoTable.appendChild(headerRow);

            // Add rows for each crypto
            cryptos.forEach(crypto => {
                const row = document.createElement('tr');
                const ownedAmount = holdings[crypto.symbol] || 0; // Get holdings for this crypto
                row.innerHTML = `
                    <td>${crypto.name}</td>
                    <td>${crypto.symbol}</td>
                    <td>$${crypto.price}</td>
                    <td class="action-buttons">
                        <button class="buy" data-symbol="${crypto.symbol}" data-price="${crypto.price}">Buy</button>
                        <button class="sell" data-symbol="${crypto.symbol}" data-price="${crypto.price}">Sell</button>
                    </td>
                    <td class="holdings">${ownedAmount.toFixed(4)} ${crypto.symbol}</td>
                `;
                cryptoTable.appendChild(row);
            });

            // Add event listeners to the new buttons
            addButtonListeners();
        } catch (error) {
            console.error('Error processing WebSocket message: ', error);
        }
    };

    socket.onclose = function () {
        console.error('WebSocket connection closed. Reconnecting in 5 seconds...');
        setTimeout(connectWebSocket, 5000);
    };

    socket.onerror = function (error) {
        console.error('WebSocket error: ', error);
        socket.close();
    };
}

// Initialize the app
document.addEventListener('DOMContentLoaded', async function () {
    // Fetch initial balance and holdings
    await fetchBalance();
    await fetchHoldings();

    // Connect to WebSocket
    connectWebSocket();

    // Add event listeners
    document.getElementById('reset-button').addEventListener('click', resetBalance);
    document.getElementById('history-button').addEventListener('click', fetchTransactionHistory);
});