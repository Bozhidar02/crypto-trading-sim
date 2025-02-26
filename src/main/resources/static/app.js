let socket;
let balance = 0;
let holdings = {}; // Store user's crypto holdings

// Modal elements
const modal = document.getElementById('transactionModal');
const modalMessage = document.getElementById('modalMessage');
const amountInput = document.getElementById('amountInput');
const confirmTransactionButton = document.getElementById('confirmTransaction');
const cancelTransactionButton = document.getElementById('cancelTransaction');
const errorElement = document.getElementById("modalError");
const confirmationText = document.getElementById("confirmationText");

// Variables to store transaction details
let currentSymbol = '';
let currentPrice = 0;
let isBuy = false;

// Function to open the modal
function openModal(symbol, price, isBuyAction) {
    currentSymbol = symbol;
    currentPrice = price;
    isBuy = isBuyAction;

    modalMessage.textContent = `Enter the amount of ${symbol} you want to ${isBuy ? 'buy' : 'sell'} at $${price} per unit.`;
    amountInput.value = ''; // Clear the input field
    errorElement.style.display = "none"; // Hide previous errors
    modal.style.display = 'block';
}

// Function to close the modal
function closeModal() {
    modal.style.display = "none";
    document.getElementById("transactionForm").style.display = "block";
    document.getElementById("confirmationMessage").style.display = "none";
    confirmationText.innerHTML = "";
    amountInput.value = "";
    errorElement.style.display = "none"; // Hide error messages on close
}

// Handle confirm button click
confirmTransactionButton.addEventListener('click', async () => {
    const amount = parseFloat(amountInput.value);
    const totalCost = (amount * currentPrice).toFixed(2);

    if (isNaN(amount) || amount <= 0) {
        showError("Please enter a valid amount.");
        return;
    }

    if (isBuy) {
        if (balance < totalCost) {
            showError("Insufficient balance.");
            return;
        }
        await buyCrypto(currentSymbol, amount, currentPrice);
    } else {
        if (!holdings[currentSymbol] || holdings[currentSymbol] < amount) {
            showError("Insufficient holdings.");
            return;
        }
        await sellCrypto(currentSymbol, amount, currentPrice);
    }
});

// Function to display error messages inside the modal
function showError(message) {
    errorElement.textContent = message;
    errorElement.style.display = "block";
}

// Function to show the confirmation message
function showConfirmationModal(message) {
    confirmationText.innerHTML = message;
    document.getElementById("transactionForm").style.display = "none";
    document.getElementById("confirmationMessage").style.display = "block";
}

// Close modal when clicking "OK"
document.getElementById('okButton').addEventListener('click', closeModal);
cancelTransactionButton.addEventListener('click', closeModal);
window.addEventListener('click', (event) => {
    if (event.target === modal) {
        closeModal();
    }
});

// Fetch balance & holdings
async function fetchBalance() {
    const response = await fetch('/api/balance');
    balance = await response.json();
    updateBalance(balance);
}

function updateBalance(newBalance) {
    document.getElementById('balance').textContent = `Balance: $${newBalance.toFixed(2)}`;
}

async function fetchHoldings() {
    const response = await fetch('/api/balance/holdings');
    holdings = await response.json();
}

async function fetchTransactionHistory() {
    const response = await fetch('/api/balance/history');
    const history = await response.json();
    document.getElementById('history-list').innerHTML = history.map(t => `<li>${t}</li>`).join('');
}

// Buy & Sell Crypto
async function buyCrypto(symbol, amount, price) {
    await fetch(`/api/balance/buy?symbol=${symbol}&amount=${amount}&price=${price}`, { method: 'POST' });
    await fetchBalance();
    await fetchHoldings();
    await fetchTransactionHistory();
    showConfirmationModal(`Purchased ${amount} ${symbol} for $${(amount * price).toFixed(2)}`);
}

async function sellCrypto(symbol, amount, price) {
    const response = await fetch(`/api/balance/sell?symbol=${symbol}&amount=${amount}&price=${price}`, { method: 'POST' });
    const result = await response.text();
    console.log("Server Response:", result);

    if (result.startsWith("Insufficient")) {
        showError(result);
        return;
    }

    await fetchBalance();
    await fetchHoldings();
    await fetchTransactionHistory();

    const profitLossMatch = result.match(/(Profit|Loss): \$(\d+(\.\d+)?)/);
    let profitLossMessage = profitLossMatch ? profitLossMatch[0] : "";

    showConfirmationModal(result, profitLossMessage);
}

// WebSocket connection for live prices
// Function to add event listeners to Buy/Sell buttons
function addButtonListeners() {
    document.querySelectorAll('.buy').forEach(button => {
        button.addEventListener('click', () => {
            const symbol = button.getAttribute('data-symbol');
            const price = parseFloat(button.getAttribute('data-price'));
            openModal(symbol, price, true); // Open modal for buying
        });
    });

    document.querySelectorAll('.sell').forEach(button => {
        button.addEventListener('click', () => {
            const symbol = button.getAttribute('data-symbol');
            const price = parseFloat(button.getAttribute('data-price'));
            openModal(symbol, price, false); // Open modal for selling
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

            // Ensure buy/sell buttons work by adding event listeners
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


document.addEventListener('DOMContentLoaded', async () => {
    modal.style.display = 'none'; // Hide modal on page load
    await fetchBalance();
    await fetchHoldings();
    connectWebSocket();
});
