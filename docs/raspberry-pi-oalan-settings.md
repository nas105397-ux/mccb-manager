# Raspberry Pi OA LAN 接続設定案

OA LAN と現場 LAN を切り離し、メイン Raspberry Pi 上の MCCB Manager だけを両側から利用するための設定案です。実機へ反映する前に、OA LAN 側の IP、現場 LAN 側の IP、保守端末の IP は現場ルールに合わせて置き換えてください。

物理構成の概要は [ハードウェア構成](hardware-architecture.md)、アプリと API の構成は [システム構成](system-architecture.md) を参照してください。この文書では、2 LAN 構成にした Raspberry Pi へ実際に入れるネットワーク設定を扱います。

## 基本方針

- メイン Raspberry Pi は 2 LAN 構成にします。
- OA LAN と現場 LAN は別 IP セグメントにします。
- Raspberry Pi はルーター、NAT、ブリッジとして使いません。
- OA LAN 側から公開するサービスは Nginx の HTTPS `443/tcp` を基本にし、接続元は許可した固定 IP だけに限定します。
- 現場 LAN 側から公開するサービスは Nginx の HTTPS `443/tcp` を基本にします。
- Express は `127.0.0.1:5000` だけで待ち受け、LAN へ直接公開しません。
- SSH は保守端末の固定 IP からだけ許可します。

## 作業前に決めること

| 項目 | 決める内容 |
| --- | --- |
| OA LAN IP | 情シスまたはネットワーク管理者から払い出し |
| OA LAN 許可端末 | MCCB Manager へ接続を許可する PC、タブレットの固定 IP |
| 現場 LAN IP | MCCB Manager 専用セグメントとして固定 |
| 保守 SSH | 現場 LAN 側で許可する保守端末 IP、鍵認証、パスワードログイン可否 |
| 証明書 | 自己署名、社内 CA、端末への配布方法 |
| 更新経路 | OA LAN 経由で更新するか、オフライン媒体で更新するか |
| 予備機 | 同じ IP と証明書で復旧するか、切替手順を別途用意するか |

## IP アドレス例

```text
OA LAN:        192.168.10.0/24
Main Pi OA:    192.168.10.50
OA gateway:    192.168.10.1
事務所 PC:     192.168.10.21
管理タブレット: 192.168.10.22

現場 LAN:      192.168.40.0/24
Main Pi 現場:  192.168.40.111
保守端末:      192.168.40.120
現場 Pi A:     192.168.40.121
現場 Pi B:     192.168.40.122
```

許可した事務所 PC は `https://192.168.10.50/#/`、現場 Raspberry Pi は `https://192.168.40.111/#/` を開きます。

## OA LAN 側の接続元制限

OA LAN 側から MCCB Manager へ接続できる機器は、固定 IP を払い出した端末だけにします。DHCP でアドレスが変わる端末を許可対象にすると、意図しない端末へ許可が移る可能性があるため、OA LAN 側の PC、タブレットは DHCP 予約または固定 IP にします。

保守端末は OA LAN 側ではなく、現場 LAN 側へ接続します。SSH は現場 LAN 側の保守端末 IP だけに許可します。

例:

```text
HTTPS 許可:
  192.168.10.21  事務所 PC
  192.168.10.22  管理タブレット

SSH 許可:
  192.168.40.120 保守端末
```

OA LAN のセグメント全体、例えば `192.168.10.0/24` を HTTPS 許可に入れないようにします。

## NIC の確認

```bash
ip -br link
nmcli device status
nmcli connection show
```

例:

```text
eth0        OA LAN
enx001122334455  現場 LAN USB アダプター
```

## 固定 IP 設定

OA LAN 側は、必要に応じて gateway と DNS を設定します。

```bash
sudo nmcli connection modify "Wired connection 1" \
  ipv4.method manual \
  ipv4.addresses 192.168.10.50/24 \
  ipv4.gateway 192.168.10.1 \
  ipv4.dns "192.168.10.1" \
  ipv6.method disabled
```

現場 LAN 側は、現場 LAN から OA LAN やインターネットへ抜けないように gateway と DNS を設定しません。

```bash
sudo nmcli connection modify "Wired connection 2" \
  ipv4.method manual \
  ipv4.addresses 192.168.40.111/24 \
  ipv4.never-default yes \
  ipv4.ignore-auto-dns yes \
  ipv6.method disabled
```

反映:

```bash
sudo nmcli connection down "Wired connection 1"
sudo nmcli connection up "Wired connection 1"
sudo nmcli connection down "Wired connection 2"
sudo nmcli connection up "Wired connection 2"
```

確認:

```bash
ip -br addr
ip route
```

`default via ...` は OA LAN 側だけにします。現場 LAN 側に default route を持たせません。

## IP 転送を無効化

```bash
sudo tee /etc/sysctl.d/99-mccb-no-routing.conf >/dev/null <<'EOF'
net.ipv4.ip_forward=0
net.ipv6.conf.all.forwarding=0
EOF

sudo sysctl --system
```

確認:

```bash
sysctl net.ipv4.ip_forward
sysctl net.ipv6.conf.all.forwarding
```

どちらも `0` なら OK です。

## アプリ待ち受け

`deploy/raspi/setup-system.sh` で作成する `mccb-manager.service` は、Express を `127.0.0.1:5000` で待ち受ける設定にします。LAN 側からは Nginx の `443/tcp` だけを使います。

確認:

```bash
systemctl cat mccb-manager.service
sudo ss -lntp
```

期待する状態:

```text
127.0.0.1:5000  node
0.0.0.0:443     nginx
0.0.0.0:80      nginx
```

## ファイアウォール例

以下は nftables の例です。保守端末 IP、OA LAN 許可端末、現場 LAN の値を必ず現場の値に合わせてから使います。

```bash
sudo apt install -y nftables
sudo systemctl enable nftables
```

```bash
sudo tee /etc/nftables.conf >/dev/null <<'EOF'
#!/usr/sbin/nft -f

flush ruleset

table inet filter {
  set oa_https_clients {
    type ipv4_addr
    elements = { 192.168.10.21, 192.168.10.22 }
  }

  set ssh_clients {
    type ipv4_addr
    elements = { 192.168.40.120 }
  }

  chain input {
    type filter hook input priority 0;
    policy drop;

    iif lo accept
    ct state established,related accept
    ip protocol icmp accept
    ip6 nexthdr icmpv6 accept

    ip saddr @oa_https_clients tcp dport 443 accept
    ip saddr 192.168.40.0/24 tcp dport 443 accept
    ip saddr @ssh_clients tcp dport 22 accept
  }

  chain forward {
    type filter hook forward priority 0;
    policy drop;
  }

  chain output {
    type filter hook output priority 0;
    policy accept;
  }
}
EOF

sudo nft -c -f /etc/nftables.conf
sudo systemctl restart nftables
```

80 番から 443 番へリダイレクトしたい場合は、`tcp dport 80 accept` も追加します。HTTPS URL を直接配布する運用なら 80 番を開けない方がシンプルです。

OA LAN 側でも 80 番を使う場合は、HTTPS と同じ接続元だけに限定します。

```nft
ip saddr @oa_https_clients tcp dport 80 accept
```

## HTTPS 証明書

自己署名証明書を使う場合は、OA LAN 側 IP と現場 LAN 側 IP の両方を SAN に入れます。

```bash
cd /home/pi/mccb-manager
MCCB_REGENERATE_CERT=1 \
MCCB_SERVER_HOST=192.168.40.111 \
MCCB_CERT_EXTRA_IPS=192.168.10.50 \
bash deploy/raspi/setup-system.sh
```

名前でアクセスする場合は、追加 DNS 名も指定できます。

```bash
MCCB_REGENERATE_CERT=1 \
MCCB_SERVER_HOST=192.168.40.111 \
MCCB_CERT_EXTRA_IPS=192.168.10.50 \
MCCB_CERT_EXTRA_DNS=mccb-manager.local \
bash deploy/raspi/setup-system.sh
```

端末側には `/etc/ssl/certs/mccb-manager-selfsigned.crt` を信頼済み証明書として登録します。可能なら自己署名証明書ではなく、社内 CA で発行した証明書を使います。

## 動作確認

メイン Raspberry Pi 上:

```bash
curl -k https://127.0.0.1/#/
curl -k https://192.168.10.50/#/
curl -k https://192.168.40.111/#/
sudo ss -lntp
sudo nft list ruleset
```

OA LAN 側の許可端末:

```text
https://192.168.10.50/#/
```

OA LAN 側の未許可端末からは、同じ URL が開けないことを確認します。

現場 Raspberry Pi:

```text
https://192.168.40.111/#/
```

現場 LAN 側の保守端末:

```bash
ssh pi@192.168.40.111
```

OA LAN 側の端末からは SSH 接続できないことを確認します。

分離確認:

```bash
ping 192.168.40.121
ssh pi@192.168.40.121
```

OA LAN 側 PC から現場 Pi へ直接到達できないことを確認します。現場 LAN 側から OA LAN 上の PC やファイルサーバーへも直接到達できないことを確認します。

## 関連ドキュメント

- [ハードウェア構成](hardware-architecture.md)
- [システム構成](system-architecture.md)
- [取扱説明・運用ガイド](operation-guide.md)
