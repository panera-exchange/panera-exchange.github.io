<p align="center">
  <img src="docs/home.png" alt="PanEx home screen" width="720">
</p>

```
██████╗  █████╗ ███╗   ██╗███████╗██╗  ██╗
██╔══██╗██╔══██╗████╗  ██║██╔════╝╚██╗██╔╝
██████╔╝███████║██╔██╗ ██║█████╗   ╚███╔╝
██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝   ██╔██╗
██║     ██║  ██║██║ ╚████║███████╗██╔╝ ██╗
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝
          P A N E R A   E X C H A N G E
```

> ⛏️ **The marketplace of the Panera Minecraft server.** Offers, requests and payments in **Tosi**, the server's currency. Items are handed over in-game: PanEx is the bulletin board and the ledger.

Built with Expo / React Native (web first) and Supabase. Invite only: accounts are created by an admin. The app is in Italian.

## ✨ Features

- 📦 **Offers** and 📜 **Requests**: publish what you sell or what you look for, priced per lot (a single unit, a stack, a shulker or any size). Buyers choose how many lots to take, and sold-out listings can be restocked.
- 🤝 **Orders**: Tosi are locked at purchase and paid to the seller when the buyer confirms the in-game delivery. Cancelling gives the Tosi back.
- 🪙 **Movements**: balance and full ledger of every Tosi that moved.
- 🏦 **Home**: BCP exchange rate, total reserve, total trades, and articles written by the admins.
- 🔎 All 1,372 items of Minecraft Java 1.21.10, with icons for about 94% of them.

## 🗄️ Under the hood

- **Tables**: `profiles`, `items`, `listings`, `orders`, `ledger`, `articles`, `settings`
- **Views**: `balances`, `market_stats`
- **Functions**: `create_listing`, `update_listing`, `withdraw_listing`, `create_order`, `confirm_order`, `cancel_order`, `grant_tosi`, `create_article`, `update_article`, `delete_article`, `update_bcp`, `exchange_stats`, `search_items`
- Row Level Security everywhere: the app can only read, and every change goes through the functions above.
- The balance is the sum of the ledger. Amounts are exact decimals (5 places), never floats.
- Item icons are generated from the game's own textures and are not part of this repository.

## 🏆 Advancements

- [x] Offers, requests, partial orders, confirmed payments
- [x] Ledger and exact decimals
- [x] Home with BCP data and admin articles
- [x] Web deploy on GitHub Pages
- [x] Andamento screen (market stats)
- [ ] Login with username only
- [ ] Notifications
- [ ] Android build
- [ ] Player skins, item categories
- [ ] Choose the publication date of articles
- [x] Funny quotes on the login screen
- [x] Online presence
- [ ] Sound or haptic feedback

## 📜 License

Code under the [MIT License](LICENSE). Fonts: VT323 and Press Start 2P (SIL OFL 1.1).
PanEx is a fan project, **not** an official Minecraft product and not affiliated with Mojang Studios or Microsoft. Tosi are a virtual currency with no real value.
