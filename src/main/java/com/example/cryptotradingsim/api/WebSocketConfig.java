package com.example.cryptotradingsim.api;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final CryptoWebSocketHandler cryptoWebSocketHandler;

    // Inject CryptoWebSocketHandler via constructor
    public WebSocketConfig(CryptoWebSocketHandler cryptoWebSocketHandler) {
        this.cryptoWebSocketHandler = cryptoWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(cryptoWebSocketHandler, "/api/crypto/live")
                .setAllowedOrigins("*"); // Allow all origins for development
    }
}