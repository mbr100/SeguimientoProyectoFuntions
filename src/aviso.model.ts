export class Aviso{
    user:  string;
    uui: string;
    email: string;
    fecha: Date;
    ip: string;


    constructor(user: string, uui: string, email: string, fecha: Date, ip: string) {
        this.user = user;
        this.uui = uui;
        this.email = email;
        this.fecha = fecha;
        this.ip = ip;
    }
}