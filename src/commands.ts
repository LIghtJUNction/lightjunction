export const COMMAND_NAMES = [
    'help',
    'about',
    'skills',
    'projects',
    'stats',
    'sponsor',
    'contact',
    'msg',
    'clear',
    'whoami',
    'pwd',
    'ls',
    'uname',
    'fastfetch',
    'reboot',
] as const

export function commandDescription(name: string): string {
    return {
        help: 'show commands',
        about: 'who this is',
        skills: 'working areas',
        projects: 'recent repositories',
        stats: 'GitHub numbers',
        sponsor: 'open-source support',
        contact: 'links and key',
        msg: 'encrypted message card',
        clear: 'clear scrollback',
        whoami: 'print identity',
        pwd: 'current path',
        ls: 'list files',
        uname: 'kernel cosplay',
        fastfetch: 'system card',
        reboot: 'reset terminal',
    }[name] ?? ''
}
