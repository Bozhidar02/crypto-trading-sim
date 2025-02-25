let socket;

function connectWebSocket() {
    socket = new WebSocket("ws://localhost:8080/api/crypto/live");

    socket.onopen = function () {
        console.log("Connected to WebSocket server");
    };

    socket.onmessage = function (event) {
        try {
            const cryptos = JSON.parse(event.data);
            const cryptoTable = document.getElementById("crypto-table");
            cryptoTable.innerHTML = "";

            // Add a header row
            const headerRow = document.createElement("tr");
            headerRow.innerHTML = `
                <th>Name</th>
                <th>Symbol</th>
                <th>Price (USD)</th>
            `;
            cryptoTable.appendChild(headerRow);

            // Add rows for each crypto
            cryptos.forEach(crypto => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${crypto.name}</td>
                    <td>${crypto.symbol}</td>
                    <td>$${crypto.price}</td>
                `;
                cryptoTable.appendChild(row);
            });
        } catch (error) {
            console.error("Error processing WebSocket message: ", error);
        }
    };

    socket.onclose = function () {
        console.error("WebSocket connection closed. Reconnecting in 5 seconds...");
        setTimeout(connectWebSocket, 5000);
    };

    socket.onerror = function (error) {
        console.error("WebSocket error: ", error);
        socket.close();
    };
}

document.addEventListener("DOMContentLoaded", connectWebSocket);