#!/bin/bash

VPN_DIR="/home/misha/Документы/vpn"
PID_FILE="$VPN_DIR/.vpn_pid"

# Только лучшие и понятные сервера (номер → название с флагом)
declare -A SERVERS
SERVERS[2]="ОАЭ Дубай (самый быстрый)"
SERVERS[18]="Канада Oracle (суперстабильный)"
SERVERS[3]="Армения Ереван (низкий пинг)"
SERVERS[8]="Бельгия Брюссель"
SERVERS[9]="Бельгия Брюссель (Chrome)"
SERVERS[5]="Австралия Сидней"
SERVERS[19]="Канада Apple"
SERVERS[20]="Канада Microsoft"
SERVERS[15]="Канада (простой)"
SERVERS[0]="Китай/Тайвань"
SERVERS[1]="VMess raw"
SERVERS[4]="VMess raw"
SERVERS[6]="Китай WS TLS"
SERVERS[7]="Китай WS TLS"
SERVERS[10]="Бразилия"
SERVERS[11]="Бразилия"
SERVERS[12]="Бразилия Google"
SERVERS[13]="Бразилия"
SERVERS[14]="Бразилия"
SERVERS[16]="Канада no-ra"
SERVERS[17]="Канада no-ws"
SERVERS[21]="Канада VMess"

# Формируем список
OPTIONS=""
for key in "${!SERVERS[@]}"; do
    OPTIONS="$OPTIONS $key ${SERVERS[$key]}"
done

while true; do
    CHOICE=$(zenity --list --radiolist --title="Мой VPN" \
        --text="Выбери сервер:" \
        --column=" " --column="Сервер" \
        $OPTIONS \
        --width=520 --height=680 --hide-header \
        --ok-label="Подключить" --cancel-label="Отключить и выйти")

    # Если нажал "Отключить и выйти"
    if [ $? -eq 1 ] || [ -z "$CHOICE" ]; then
        if [ -f "$PID_FILE" ]; then
            kill $(cat "$PID_FILE") 2>/dev/null
            rm "$PID_FILE"
            gsettings set org.gnome.system.proxy mode none
            zenity --info --text="VPN отключён\nПрокси выключен" --width=300
        fi
        break
    fi

    # Убиваем старый процесс
    if [ -f "$PID_FILE" ]; then
        kill $(cat "$PID_FILE") 2>/dev/null
        rm "$PID_FILE"
    fi

    # Запускаем новый
    cd "$VPN_DIR"
    node vpn.js "$CHOICE" > vpn.log 2>&1 &
    echo $! > "$PID_FILE"

    # Включаем прокси
    gsettings set org.gnome.system.proxy mode manual
    gsettings set org.gnome.system.proxy.socks host 127.0.0.1
    gsettings set org.gnome.system.proxy.socks port 1080

    zenity --info --title="Подключено!" \
        --text="${SERVERS[$CHOICE]}\n\nТрафик идёт через VPN\nПроверь IP на whoer.ip" \
        --width=400 --timeout=4
done
