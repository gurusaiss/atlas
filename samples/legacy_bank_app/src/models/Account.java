package com.legacybank.models;

import java.math.BigDecimal;

public class Account {
    private Long id;
    private Long userId;
    private String accountNumber;
    private BigDecimal balance;
    private String accountType;

    public Account() {
    }

    public Account(Long id, Long userId, String accountNumber, BigDecimal balance, String accountType) {
        this.id = id;
        this.userId = userId;
        this.accountNumber = accountNumber;
        this.balance = balance;
        this.accountType = accountType;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public BigDecimal getBalance() {
        return balance;
    }

    public void setBalance(BigDecimal balance) {
        this.balance = balance;
    }

    public String getAccountType() {
        return accountType;
    }
}
