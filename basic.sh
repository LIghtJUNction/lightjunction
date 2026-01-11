#/bin/bash

hook() {
    local func_decl="$1"
    local func_name="${func_decl%%()*}"
    if ! declare -f "$func_name" >/dev/null 2>&1; then
        return 1
    fi
    if ! declare -f "self_$func_name" >/dev/null 2>&1; then
        eval "self_$func_name() { $func_name \"\$@\"; }"
    fi
    local body
    body=$(cat)
    eval "$func_name() {
        local self=self_$func_name
$body
    }"
}


hook import() {
    declare -gA __imported_files
    [[ -n "${__imported_files[$1]}" ]] ||
    {
        __imported_files[$1]=1
        self "$@"
    }
}
