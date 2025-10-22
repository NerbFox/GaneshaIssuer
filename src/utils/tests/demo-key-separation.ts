/**
 * Quick Demo: BIP44 Change Level Key Separation
 * 
 * Run this to see the key separation in action
 */

import {
  generateNewWallet,
  generateWalletFromMnemonic,
  ENTROPY_BITS_12_WORDS,
} from '../seedphrase';

async function demo() {
  console.log('\n' + '━'.repeat(80));
  console.log('🔐 BIP44 CHANGE LEVEL KEY SEPARATION - QUICK DEMO');
  console.log('━'.repeat(80));

  // Generate a new wallet
  const wallet = await generateNewWallet(ENTROPY_BITS_12_WORDS, 'i');

  console.log('\n📋 Mnemonic (12 words):');
  console.log('   ', wallet.mnemonic.join(' '));

  console.log('\n' + '─'.repeat(80));
  console.log('🔑 KEY DERIVATION PATHS');
  console.log('─'.repeat(80));

  console.log('\n🔐 SIGNING KEY (m/44\'/1001\'/0\'/0\'/0\'):');
  console.log('   └─ Change Level: 0 (External chain)');
  console.log('   └─ Purpose:      Signing operations');
  console.log('   └─ Can Rotate:   YES (change address index)');
  console.log('   └─ Public Key:   ', wallet.signingKey.publicKeyHex);

  console.log('\n🆔 DID KEY (m/44\'/1001\'/0\'/1\'/0\'):');
  console.log('   └─ Change Level: 1 (Internal chain)');
  console.log('   └─ Purpose:      DID identifier ONLY');
  console.log('   └─ Can Rotate:   NO (always index 0)');
  console.log('   └─ Public Key:   ', wallet.didKey.publicKeyHex);

  console.log('\n🌐 DID Identifier:');
  console.log('   ', wallet.did);
  console.log('   └─ Length:       ', wallet.did.length, 'characters');
  console.log('   └─ Format:        did:dcert:{i|u}{44_char_base64url}');

  // Demonstrate key separation
  console.log('\n' + '─'.repeat(80));
  console.log('✨ KEY SEPARATION BENEFIT: ROTATION WITHOUT DID CHANGE');
  console.log('─'.repeat(80));

  const wallet0 = await generateWalletFromMnemonic(wallet.mnemonic, 'i', '', 0);
  const wallet1 = await generateWalletFromMnemonic(wallet.mnemonic, 'i', '', 1);
  const wallet2 = await generateWalletFromMnemonic(wallet.mnemonic, 'i', '', 2);

  console.log('\n📊 Same Mnemonic, Different Signing Key Indices:');
  console.log('\n   Index 0:');
  console.log('      Signing Key:', wallet0.signingKey.publicKeyHex.slice(0, 20), '...');
  console.log('      DID:        ', wallet0.did);

  console.log('\n   Index 1:');
  console.log('      Signing Key:', wallet1.signingKey.publicKeyHex.slice(0, 20), '...');
  console.log('      DID:        ', wallet1.did);

  console.log('\n   Index 2:');
  console.log('      Signing Key:', wallet2.signingKey.publicKeyHex.slice(0, 20), '...');
  console.log('      DID:        ', wallet2.did);

  // Verify
  const sameDID = wallet0.did === wallet1.did && wallet0.did === wallet2.did;
  const diffSigning = 
    wallet0.signingKey.publicKeyHex !== wallet1.signingKey.publicKeyHex &&
    wallet0.signingKey.publicKeyHex !== wallet2.signingKey.publicKeyHex;

  console.log('\n✅ Result:');
  console.log('   └─ DID stays same:       ', sameDID ? '✓ YES' : '✗ NO');
  console.log('   └─ Signing keys differ:  ', diffSigning ? '✓ YES' : '✗ NO');

  console.log('\n' + '─'.repeat(80));
  console.log('💡 USE CASE');
  console.log('─'.repeat(80));
  console.log('\n   Scenario: Institution\'s signing key is compromised');
  console.log('   Solution: Rotate to new index (0 → 1)');
  console.log('   Result:   New signing key, SAME DID identifier');
  console.log('   Benefit:  No need to update DID registrations!');

  console.log('\n' + '━'.repeat(80));
  console.log('✅ DEMO COMPLETE');
  console.log('━'.repeat(80) + '\n');
}

demo().catch(console.error);
