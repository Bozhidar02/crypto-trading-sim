package com.example.cryptotradingsim.api;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class KrakenService {
    private static final String WEBSOCKET_URL = "wss://ws.kraken.com";
    private static final String REST_API_URL = "https://api.kraken.com/0/public/AssetPairs";
    //private static final String ASSETS_API_URL = "https://api.kraken.com/0/public/Assets";
    private final Map<String, Map<String, String>> cryptoData = new ConcurrentHashMap<>();
    private final CryptoWebSocketHandler webSocketHandler;
    private final RestTemplate restTemplate;


    private WebSocketClient client;

    public KrakenService(CryptoWebSocketHandler webSocketHandler, RestTemplate restTemplate) {
        this.webSocketHandler = webSocketHandler;
        this.restTemplate = restTemplate;
        fetchAssetNames();
        connectWebSocket();
    }

    //Using COINGECKO to map the names on the currencies  as Kraken does not seem to have the names of the currencies
    private static final String COINGECKO_API_URL = "https://api.coingecko.com/api/v3/coins/list";
    private final Map<String, String> assetNames = new ConcurrentHashMap<>();

    // Manual fallback mapping for Kraken’s usual tickers, Kraken Api
    private static final Map<String, String> FALLBACK_NAMES = Map.of(
            "XBT", "Bitcoin",
            "ETH", "Ethereum",
            "XRP", "XRP",
            "LTC", "Litecoin",
            "BCH", "Bitcoin Cash",
            "ADA", "Cardano",
            "DOT", "Polkadot",
            "LINK", "Chainlink",
            "XLM", "Stellar",
            "DOGE", "Dogecoin"
    );

    private void fetchAssetNames() {
        try {
            // Fetch asset metadata from CoinGecko API
            String response = restTemplate.getForObject(COINGECKO_API_URL, String.class);
            JSONArray jsonResponse = new JSONArray(response);

            // Extract asset names
            for (int i = 0; i < jsonResponse.length(); i++) {
                JSONObject coin = jsonResponse.getJSONObject(i);
                String symbol = coin.getString("symbol").toUpperCase(); // Convert to uppercase
                String name = coin.getString("name");

                assetNames.put(symbol, name);
            }

        } catch (Exception e) {
            System.err.println("Error fetching asset names: " + e.getMessage());
        }
    }



    private void connectWebSocket() {
        try {
            client = new WebSocketClient(URI.create(WEBSOCKET_URL)) {
                @Override
                public void onOpen(ServerHandshake handshakedata) {
                    System.out.println("Connected to Kraken WebSocket");

                    // Fetch trading pairs dynamically and subscribe to them
                    List<String> tradingPairs = fetchTradingPairs();
                    if (!tradingPairs.isEmpty()) {
                        subscribeToTickerUpdates(tradingPairs);
                    } else {
                        System.err.println("No trading pairs found.");
                    }
                }

                @Override
                public void onMessage(String message) {
                    processMessage(message);
                }

                @Override
                public void onClose(int code, String reason, boolean remote) {
                    System.out.println("WebSocket closed: " + reason);
                    scheduleReconnect();
                }

                @Override
                public void onError(Exception ex) {
                    System.err.println("WebSocket error: " + ex.getMessage());
                    ex.printStackTrace();
                }
            };

            client.connect();
        } catch (Exception e) {
            System.err.println("Error connecting to WebSocket: " + e.getMessage());
            scheduleReconnect();
        }
    }

    private List<String> fetchTradingPairs() {
        List<String> tradingPairs = new ArrayList<>();
        try {
            // Fetch trading pairs from Kraken REST API
            String response = restTemplate.getForObject(REST_API_URL, String.class);
            JSONObject jsonResponse = new JSONObject(response);
            JSONObject result = jsonResponse.getJSONObject("result");

            // Extract trading pairs
            for (String key : result.keySet()) {
                JSONObject pairInfo = result.getJSONObject(key);
                String wsname = pairInfo.optString("wsname", ""); // Use "wsname" field
                if (wsname.endsWith("/USD")) { // Filter pairs trading against USD
                    tradingPairs.add(wsname);
                }
            }

            // Log the fetched trading pairs
            System.out.println("Fetched trading pairs: " + tradingPairs);
        } catch (Exception e) {
            System.err.println("Error fetching trading pairs: " + e.getMessage());
        }
        return tradingPairs;
    }

    private void subscribeToTickerUpdates(List<String> tradingPairs) {
        try {
            JSONObject subscribeMessage = new JSONObject();
            subscribeMessage.put("event", "subscribe");
            subscribeMessage.put("subscription", new JSONObject().put("name", "ticker"));
            subscribeMessage.put("pair", new JSONArray(tradingPairs));

            client.send(subscribeMessage.toString());
            System.out.println("Subscribed to trading pairs: " + tradingPairs);
        } catch (Exception e) {
            System.err.println("Error subscribing to ticker updates: " + e.getMessage());
        }
    }

    private void processMessage(String message) {
        try {
            // Check if the message is a JSON array or object
            if (message.trim().startsWith("[")) {
                // Parse the message as a JSON array
                JSONArray jsonArray = new JSONArray(message);

                // Ensure the array has the expected structure
                if (jsonArray.length() >= 4) {
                    // Extract the pair and price data
                    String pair = jsonArray.getString(3);
                    JSONObject tickerData = jsonArray.getJSONObject(1);
                    String price = tickerData.getJSONArray("a").getString(0);

                    // Store crypto data
                    Map<String, String> cryptoInfo = new HashMap<>();
                    cryptoInfo.put("symbol", pair);
                    cryptoInfo.put("name", getCryptoName(pair));
                    cryptoInfo.put("price", price);

                    cryptoData.put(pair, cryptoInfo);

                    sendUpdateToClients();
                }
            } else if (message.trim().startsWith("{")) {
                JSONObject jsonMessage = new JSONObject(message);

                if (jsonMessage.has("event")) {
                    String eventType = jsonMessage.getString("event");
                    if ("subscriptionStatus".equals(eventType)) {
                        System.out.println("Subscription confirmed: " + jsonMessage.getString("pair"));
                    }
                }
            } else {
                System.err.println("Unknown message format: " + message);
            }
        } catch (Exception e) {
            System.err.println("Error processing message: " + e.getMessage());
        }
    }

    private void scheduleReconnect() {
        System.out.println("Scheduling reconnection...");
        new Thread(() -> {
            try {
                Thread.sleep(5000); // Wait for 5 seconds before reconnecting
                connectWebSocket();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                System.err.println("Reconnection error: " + e.getMessage());
            }
        }).start();
    }

    private void reconnect() {
        System.out.println("Reconnecting...");
        try {
            Thread.sleep(5000);
            connectWebSocket();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private String getCryptoName(String symbol) {
        String baseCurrency = symbol.split("/")[0];

        // First we use the fallback map as the CoinGekko does not always match  and these are the most common names
        if (FALLBACK_NAMES.containsKey(baseCurrency)) {
            return FALLBACK_NAMES.get(baseCurrency);
        }

        //  then we try CoinGecko’s API data
        if (assetNames.containsKey(baseCurrency)) {
            return assetNames.get(baseCurrency);
        }

        // As a last resort, we return the symbol itself
        return baseCurrency;
    }



    private void sendUpdateToClients() {
        List<Map<String, String>> sortedTopCryptos = cryptoData.values().stream()
                .sorted((a, b) -> Double.compare(
                        Double.parseDouble(b.get("price")),
                        Double.parseDouble(a.get("price"))
                ))
                .limit(20)
                .toList();

        // Convert the list to a JSON string
        String jsonMessage = new JSONArray(sortedTopCryptos).toString();

        // Send the update to all connected WebSocket clients
        webSocketHandler.sendUpdateToClients(jsonMessage);
    }
}