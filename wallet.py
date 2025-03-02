import json

def save_wallets():
    wallets = []
    try:
        num = int(input("How many wallets do you want to save? "))
        for i in range(num):
            print(f"Enter details for wallet {i+1}:")
            address = input("Address: ")
            private_key = input("Private Key: ")
            wallets.append({"address": address, "privateKey": private_key})
        
        with open("wallets.json", "w") as file:
            json.dump(wallets, file, indent=2)
        
        print("Wallets saved successfully in wallets.json")
    except ValueError:
        print("Invalid input! Please enter a valid number.")

if __name__ == "__main__":
    save_wallets()