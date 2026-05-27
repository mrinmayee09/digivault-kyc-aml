import subprocess
import json
import os
import logging

logger = logging.getLogger(__name__)

def anchor_identity(user_id: int, xml_hash_hex: str):
    # 1. Pull values from environment
    CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
    DEPLOYER_PRIVATE_KEY = os.getenv("DEPLOYER_PRIVATE_KEY")
    BLOCKCHAIN_RPC_URL = os.getenv("BLOCKCHAIN_RPC_URL")
    
    # 2. Load ABI from Hardhat artifacts
    abi_path = r"C:\Users\Administrator\Desktop\kyc_aml\backend\blockchain\artifacts\contracts\IdentityAnchor.sol\IdentityAnchor.json"
    try:
        with open(abi_path, "r") as f:
            artifact = json.load(f)
            CONTRACT_ABI = json.loads(json.dumps(artifact["abi"]))
    except Exception as e:
        logger.error(f"Could not load ABI: {e}")
        return None

    # 3. Path to the SPECIFIC root web3 venv
    web3_python = r"C:\Users\mrinm\Downloads\phase_1\digivault\web3_venv\Scripts\python.exe"

    # 4. The Subprocess Script
    script = f"""
import sys
import json
from web3 import Web3

try:
    w3 = Web3(Web3.HTTPProvider("{BLOCKCHAIN_RPC_URL}"))
    
    if not w3.is_connected():
        print("ERROR: Not connected to blockchain node")
        sys.exit(1)

    abi_data = json.loads('''{json.dumps(CONTRACT_ABI)}''')
    
    contract = w3.eth.contract(
        address=Web3.to_checksum_address("{CONTRACT_ADDRESS}"),
        abi=abi_data
    )
    
    account = w3.eth.account.from_key("{DEPLOYER_PRIVATE_KEY}")
    nonce = w3.eth.get_transaction_count(account.address)
    doc_hash = bytes.fromhex("{xml_hash_hex}")

    tx = contract.functions.anchorIdentity(
        {user_id}, doc_hash
    ).build_transaction({{
        "from": account.address,
        "nonce": nonce,
        "gas": 300000,
        "gasPrice": w3.eth.gas_price,
    }})

    signed = w3.eth.account.sign_transaction(tx, "{DEPLOYER_PRIVATE_KEY}")
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
    
    # SAFE PRINT: Try both v7 and v6 naming conventions
    res_hash = getattr(receipt, 'transaction_hash', getattr(receipt, 'transactionHash', None))
    
    if res_hash:
        print("0x" + res_hash.hex())
    else:
        print(f"ERROR: Could not find hash in receipt keys: {{list(receipt.keys())}}")

except Exception as e:
    print(f"ERROR: {{str(e)}}")
    sys.exit(1)
"""

    try:
        result = subprocess.run(
            [web3_python, "-c", script],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        output = result.stdout.strip()
        
        if output.startswith("0x"):
            logger.info("Blockchain anchor successful: %s", output)
            return output
        else:
            logger.error("Blockchain subprocess error: STDOUT: %s | STDERR: %s", output, result.stderr)
            return None
            
    except Exception as e:
        logger.error("Blockchain subprocess failed to launch: %s", e)
        return None