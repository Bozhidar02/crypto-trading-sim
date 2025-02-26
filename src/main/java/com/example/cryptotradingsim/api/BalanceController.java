package com.example.cryptotradingsim.api;

import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/balance")
@CrossOrigin(origins = "*")
public class BalanceController {
    private static final double INITIAL_BALANCE = 10000.0;
    private double balance = INITIAL_BALANCE; // stores virtual balance
    private final Map<String, Double> holdings = new HashMap<>(); // Store crypto amounts
    private final List<String> transactionHistory = new ArrayList<>();
    private final Map<String, Double> purchases = new HashMap<>();


    @GetMapping
    public double getBalance() {//get current balance
        return balance;
    }

    @PostMapping("/reset")
    public void resetBalance() {
        balance = INITIAL_BALANCE;
        transactionHistory.clear();
        purchases.clear();
        holdings.clear();
    }

    @PostMapping("/buy")
    public String buyCrypto(@RequestParam String symbol, @RequestParam double amount, @RequestParam double price) {
        double cost = amount * price;

        if (cost > balance) {
            return "Insufficient funds to buy " + amount + " " + symbol;
        }

        balance -= cost;
        holdings.put(symbol, holdings.getOrDefault(symbol, 0.0) + amount);
        purchases.put(symbol, price);
        String transaction = "Bought " + amount + " " + symbol + " at $" + price + " each (Total: $" + cost + ")";
        transactionHistory.add(transaction);

        return transaction;
    }

    @PostMapping("/sell")
    public String sellCrypto(@RequestParam String symbol, @RequestParam double amount, @RequestParam double price) {
        double owned = holdings.getOrDefault(symbol, 0.0);

        if (owned < amount) {
            return "Insufficient " + symbol + " to sell " + amount;
        }

        double earnings = amount * price;
        balance += earnings;
        holdings.put(symbol, owned - amount);

        if (holdings.get(symbol) <= 0) {
            holdings.remove(symbol);
            purchases.remove(symbol);
        }

        double purchasePrice = purchases.getOrDefault(symbol, 0.0);
        // Store weighted average purchase price
        double existingAmount = holdings.getOrDefault(symbol, 0.0);
        double newTotalAmount = existingAmount + amount;
        double averagePurchasePrice = ((existingAmount * purchases.getOrDefault(symbol, 0.0)) + (amount * price)) / newTotalAmount;
        purchases.put(symbol, averagePurchasePrice);

        double profitLoss = (price - purchasePrice)*amount;
        profitLoss = Math.round(profitLoss*100.0)/100.0;
        String transaction = String.format(
                "Sold %.4f %s at $%.2f each (Total: $%.2f) %s $%.2f",
                amount, symbol, price, earnings,
                (profitLoss >= 0 ? "Profit:" : "Loss:"), Math.abs(profitLoss)
        );
        transactionHistory.add(transaction);

        return transaction;
    }

    @GetMapping("/history")
    public List<String> getTransactionHistory() {
        return transactionHistory;
    }

    @GetMapping("/holdings")
    public Map<String, Double> getHoldings() {
        return holdings;
    }
}
