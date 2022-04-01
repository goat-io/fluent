#!/usr/bin/expect -f
set timeout -1

spawn ./installer.sh

expect "means Apple, Inc"

send -- " \n"

expect "License to Apple Software"

send -- " \n"

expect "software, and Licensee hereby"

send -- " \n"

expect "immediately upon written noti"

send -- " \n"

expect "INCLUDING WITHOUT LIMITATION THE IMPL"

send -- " \n"

expect "Indemnification by Apple"

send -- " \n"

expect "franchisor and franchisee"

send -- " \n"

expect "agreements entered into and to be performe"

send -- " \n"

expect "defined in clause 52.22"

send -- " \n"

expect "Do you agree to the above license terms"

send -- "yes \n"

expect "Continue?"

send -- "yes \n"

expect eof